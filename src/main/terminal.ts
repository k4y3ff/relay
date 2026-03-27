import * as pty from 'node-pty';
import { BrowserWindow } from 'electron';

export class TerminalManager {
  private ptys = new Map<string, pty.IPty>();
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
    });

    proc.onExit(() => {
      this.ptys.delete(worktreePath);
    });

    this.ptys.set(worktreePath, proc);
  }

  write(worktreePath: string, data: string): void {
    this.ptys.get(worktreePath)?.write(data);
  }

  resize(worktreePath: string, cols: number, rows: number): void {
    this.ptys.get(worktreePath)?.resize(cols, rows);
  }

  killAll(): void {
    for (const proc of this.ptys.values()) {
      proc.kill();
    }
    this.ptys.clear();
  }
}
