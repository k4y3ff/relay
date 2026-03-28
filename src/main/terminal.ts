import * as pty from 'node-pty';
import { BrowserWindow, Notification } from 'electron';
import { store } from './store.js';

interface WorktreeNotifyState {
  pendingResponse: boolean;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

export class TerminalManager {
  private ptys = new Map<string, pty.IPty>();
  private notifyState = new Map<string, WorktreeNotifyState>();
  private win: BrowserWindow;

  constructor(win: BrowserWindow) {
    this.win = win;
  }

  create(worktreePath: string, cols: number, rows: number): void {
    if (this.ptys.has(worktreePath)) return;

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
      this.win.webContents.send('terminal:data', { worktreePath, data });

      const s = this.notifyState.get(worktreePath);
      if (s?.pendingResponse) {
        if (s.idleTimer !== null) clearTimeout(s.idleTimer);
        s.idleTimer = setTimeout(() => {
          s.idleTimer = null;
          s.pendingResponse = false;
          if (!this.win.isDestroyed() && !this.win.isFocused()) {
            this.fireNotification(worktreePath);
          }
        }, 1500);
      }
    });

    proc.onExit(() => {
      this.ptys.delete(worktreePath);
      const s = this.notifyState.get(worktreePath);
      if (s?.idleTimer !== null) clearTimeout(s!.idleTimer!);
      this.notifyState.delete(worktreePath);
    });

    this.ptys.set(worktreePath, proc);
  }

  write(worktreePath: string, data: string): void {
    this.ptys.get(worktreePath)?.write(data);

    if (/[\r\n]/.test(data)) {
      const s = this.getOrCreateNotifyState(worktreePath);
      s.pendingResponse = true;
      if (s.idleTimer !== null) {
        clearTimeout(s.idleTimer);
        s.idleTimer = null;
      }
    }
  }

  resize(worktreePath: string, cols: number, rows: number): void {
    this.ptys.get(worktreePath)?.resize(cols, rows);
  }

  killAll(): void {
    for (const proc of this.ptys.values()) {
      proc.kill();
    }
    this.ptys.clear();
    this.notifyState.clear();
  }

  private getOrCreateNotifyState(worktreePath: string): WorktreeNotifyState {
    if (!this.notifyState.has(worktreePath)) {
      this.notifyState.set(worktreePath, { pendingResponse: false, idleTimer: null });
    }
    return this.notifyState.get(worktreePath)!;
  }

  private resolveLabels(worktreePath: string): { groupName: string; branchName: string } | null {
    const groups = store.get('taskGroups');
    for (const group of groups) {
      if (group.branches.some((b) => b.worktreePath === worktreePath)) {
        return {
          groupName: group.name,
          branchName: worktreePath.split('/').pop() ?? worktreePath,
        };
      }
    }
    return null;
  }

  private fireNotification(worktreePath: string): void {
    if (!Notification.isSupported()) return;
    const labels = this.resolveLabels(worktreePath);
    if (!labels) return;

    const notif = new Notification({
      title: labels.groupName,
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
