import { spawn, ChildProcess } from 'node:child_process';
import { BrowserWindow } from 'electron';
import type { ClaudeStreamEvent, StreamEventEnvelope } from '../renderer/types/chat.js';

export class ClaudeManager {
  private processes = new Map<string, ChildProcess>();
  private buffers = new Map<string, string>();
  private win: BrowserWindow;

  constructor(win: BrowserWindow) {
    this.win = win;
  }

  sendMessage(worktreePath: string, text: string): void {
    const proc = this.ensureProcess(worktreePath);
    proc.stdin!.write(text + '\n');
  }

  newChat(worktreePath: string): void {
    const proc = this.processes.get(worktreePath);
    if (proc) {
      proc.kill('SIGTERM');
      this.processes.delete(worktreePath);
      this.buffers.delete(worktreePath);
    }
  }

  stop(worktreePath: string): void {
    const proc = this.processes.get(worktreePath);
    if (proc) {
      proc.kill('SIGINT');
    }
  }

  killAll(): void {
    for (const [, proc] of this.processes) {
      proc.kill('SIGTERM');
    }
    this.processes.clear();
    this.buffers.clear();
  }

  private ensureProcess(worktreePath: string): ChildProcess {
    if (this.processes.has(worktreePath)) {
      return this.processes.get(worktreePath)!;
    }

    const proc = spawn('claude', ['--output-format', 'stream-json', '--verbose'], {
      cwd: worktreePath,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    this.buffers.set(worktreePath, '');

    proc.stdout!.on('data', (chunk: Buffer) => {
      this.handleStdoutChunk(worktreePath, chunk);
    });

    proc.stderr!.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      // Only surface non-empty stderr lines as errors
      if (text.trim()) {
        this.dispatchEvent(worktreePath, { type: 'error', message: text.trim() });
      }
    });

    proc.on('exit', () => {
      this.processes.delete(worktreePath);
      this.buffers.delete(worktreePath);
    });

    this.processes.set(worktreePath, proc);
    return proc;
  }

  private handleStdoutChunk(worktreePath: string, chunk: Buffer): void {
    const buf = (this.buffers.get(worktreePath) ?? '') + chunk.toString('utf8');
    const lines = buf.split('\n');
    this.buffers.set(worktreePath, lines.pop() ?? '');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const event: ClaudeStreamEvent = JSON.parse(trimmed);
        this.dispatchEvent(worktreePath, event);
      } catch {
        // malformed line — ignore
      }
    }
  }

  private dispatchEvent(worktreePath: string, event: ClaudeStreamEvent): void {
    if (this.win.isDestroyed()) return;
    const envelope: StreamEventEnvelope = { worktreePath, event };
    this.win.webContents.send('claude:stream-event', envelope);
  }
}
