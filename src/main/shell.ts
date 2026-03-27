import * as pty from 'node-pty';
import { BrowserWindow } from 'electron';

export class ShellManager {
  private ptys = new Map<string, pty.IPty>();
  private win: BrowserWindow;

  constructor(win: BrowserWindow) {
    this.win = win;
  }

  create(tabId: string, cwd: string, cols: number, rows: number): void {
    if (this.ptys.has(tabId)) return;

    const shell = process.env.SHELL || '/bin/zsh';
    const proc = pty.spawn(shell, ['-l'], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: process.env as Record<string, string>,
    });

    proc.onData((data) => {
      if (this.win.isDestroyed()) return;
      this.win.webContents.send('shell:data', { tabId, data });
    });

    proc.onExit(() => {
      this.ptys.delete(tabId);
      if (!this.win.isDestroyed()) {
        this.win.webContents.send('shell:exit', { tabId });
      }
    });

    this.ptys.set(tabId, proc);
  }

  write(tabId: string, data: string): void {
    this.ptys.get(tabId)?.write(data);
  }

  resize(tabId: string, cols: number, rows: number): void {
    this.ptys.get(tabId)?.resize(cols, rows);
  }

  close(tabId: string): void {
    const proc = this.ptys.get(tabId);
    if (proc) {
      proc.kill();
      this.ptys.delete(tabId);
    }
  }

  killAll(): void {
    for (const proc of this.ptys.values()) {
      proc.kill();
    }
    this.ptys.clear();
  }
}
