import * as pty from 'node-pty';
import { BrowserWindow, Notification } from 'electron';
import path from 'path';
import { store } from './store.js';

interface WorktreeNotifyState {
  pendingResponse: boolean;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

export class TerminalManager {
  private ptys = new Map<string, pty.IPty>();
  private terminalPaths = new Map<string, string>(); // terminalId → worktreePath
  private notifyState = new Map<string, WorktreeNotifyState>();
  private win: BrowserWindow;

  constructor(win: BrowserWindow) {
    this.win = win;
  }

  create(terminalId: string, worktreePath: string, cols: number, rows: number): void {
    if (this.ptys.has(terminalId)) return;

    this.terminalPaths.set(terminalId, worktreePath);

    const shell = process.env.SHELL || '/bin/zsh';
    const proc = pty.spawn(shell, ['-l', '-c', 'claude'], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: worktreePath,
      env: process.env as Record<string, string>,
    });

    proc.onData((data) => {
      if (this.win.isDestroyed()) return;
      this.win.webContents.send('terminal:data', { terminalId, data });

      const s = this.notifyState.get(terminalId);
      if (s?.pendingResponse) {
        if (s.idleTimer !== null) clearTimeout(s.idleTimer);
        s.idleTimer = setTimeout(() => {
          s.idleTimer = null;
          s.pendingResponse = false;
          if (!this.win.isDestroyed()) {
            const path = this.terminalPaths.get(terminalId) ?? worktreePath;
            this.win.webContents.send('response:complete', { worktreePath: path });
            if (!this.win.isFocused()) {
              this.fireNotification(path);
            }
          }
        }, 1500);
      }
    });

    proc.onExit(() => {
      this.ptys.delete(terminalId);
      const s = this.notifyState.get(terminalId);
      if (s?.idleTimer !== null) clearTimeout(s!.idleTimer!);
      this.notifyState.delete(terminalId);
      this.terminalPaths.delete(terminalId);
    });

    this.ptys.set(terminalId, proc);
  }

  write(terminalId: string, data: string): void {
    this.ptys.get(terminalId)?.write(data);

    if (/[\r\n]/.test(data)) {
      const s = this.getOrCreateNotifyState(terminalId);
      if (!s.pendingResponse) {
        s.pendingResponse = true;
        if (!this.win.isDestroyed()) {
          const path = this.terminalPaths.get(terminalId) ?? worktreePath;
          this.win.webContents.send('response:start', { worktreePath: path });
        }
      }
      if (s.idleTimer !== null) {
        clearTimeout(s.idleTimer);
        s.idleTimer = null;
      }
    }
  }

  resize(terminalId: string, cols: number, rows: number): void {
    this.ptys.get(terminalId)?.resize(cols, rows);
  }

  killAll(): void {
    for (const proc of this.ptys.values()) {
      proc.kill();
    }
    this.ptys.clear();
    this.notifyState.clear();
    this.terminalPaths.clear();
  }

  private getOrCreateNotifyState(terminalId: string): WorktreeNotifyState {
    if (!this.notifyState.has(terminalId)) {
      this.notifyState.set(terminalId, { pendingResponse: false, idleTimer: null });
    }
    return this.notifyState.get(terminalId)!;
  }

  private resolveLabels(worktreePath: string): { groupName: string; branchName: string; repoName: string } | null {
    const groups = store.get('taskGroups');
    for (const group of groups) {
      const task = group.tasks.find((t) => t.type === 'branch' && t.worktreePath === worktreePath);
      if (task) {
        return {
          groupName: group.name,
          branchName: worktreePath.split('/').pop() ?? worktreePath,
          repoName: task.repoRootPath ? path.basename(task.repoRootPath) : '',
        };
      }
    }
    return null;
  }

  private fireNotification(worktreePath: string): void {
    if (!Notification.isSupported()) return;
    if (!store.get('notificationsEnabled')) return;
    const labels = this.resolveLabels(worktreePath);
    if (!labels) return;

    const notif = new Notification({
      title: labels.groupName,
      subtitle: labels.repoName,
      body: `Claude finished on ${labels.branchName}`,
    });

    notif.on('click', () => {
      if (this.win.isDestroyed()) return;
      this.win.show();
      this.win.focus();
      this.win.webContents.send('navigate:worktree', { worktreePath });
    });

    notif.show();
  }
}
