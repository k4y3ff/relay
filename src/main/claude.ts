import { spawn, execFile, ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { BrowserWindow } from 'electron';
import type { ClaudeDisplayEvent } from '../renderer/types/chat.js';

const execFileAsync = promisify(execFile);

// Raw content block shapes from the claude CLI stream-json format
interface RawTextBlock { type: 'text'; text: string }
interface RawThinkingBlock { type: 'thinking'; thinking: string }
interface RawToolUseBlock { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
type RawContentBlock = RawTextBlock | RawThinkingBlock | RawToolUseBlock;

interface RawSystemEvent {
  type: 'system';
  subtype: string;
  session_id?: string;
}

interface RawAssistantEvent {
  type: 'assistant';
  message: { content: RawContentBlock[] };
}

interface RawToolResultEvent {
  type: 'tool_result';
  tool_use_id: string;
  content: unknown;
  is_error?: boolean;
}

interface RawResultEvent {
  type: 'result';
  total_cost_usd?: number;
  duration_ms?: number;
  num_turns?: number;
  is_error?: boolean;
  error?: string;
}

interface RawErrorEvent {
  type: 'error';
  error?: { message?: string } | string;
  message?: string;
}

type RawClaudeEvent =
  | RawSystemEvent
  | RawAssistantEvent
  | RawToolResultEvent
  | RawResultEvent
  | RawErrorEvent;

interface SessionEntry {
  sessionId: string | null;
  currentProc: ChildProcess | null;
}

export class ClaudeManager {
  private sessions = new Map<string, SessionEntry>();
  private win: BrowserWindow;

  constructor(win: BrowserWindow) {
    this.win = win;
  }

  async validate(): Promise<{ installed: boolean }> {
    try {
      await execFileAsync('claude', ['--version']);
      return { installed: true };
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return { installed: false };
      // Non-zero exit but binary exists (e.g. version info printed to stderr)
      return { installed: true };
    }
  }

  send(worktreePath: string, text: string): void {
    let entry = this.sessions.get(worktreePath);
    if (!entry) {
      entry = { sessionId: null, currentProc: null };
      this.sessions.set(worktreePath, entry);
    }

    // Kill any in-progress request before starting a new one
    if (entry.currentProc) {
      entry.currentProc.kill();
      entry.currentProc = null;
    }

    const args = [
      '--print', text,
      '--output-format', 'stream-json',
      '--verbose',
      '--include-partial-messages',
    ];

    if (entry.sessionId) {
      args.push('--resume', entry.sessionId);
    }

    const proc = spawn('claude', args, {
      cwd: worktreePath,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    entry.currentProc = proc;

    let lineBuffer = '';
    let stderrBuffer = '';

    proc.stdout?.on('data', (chunk: Buffer) => {
      lineBuffer += chunk.toString('utf8');
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) this.handleLine(worktreePath, trimmed);
      }
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      stderrBuffer += chunk.toString('utf8');
    });

    proc.on('exit', (code, signal) => {
      const e = this.sessions.get(worktreePath);
      if (e) e.currentProc = null;

      // Flush any remaining buffered line
      if (lineBuffer.trim()) {
        this.handleLine(worktreePath, lineBuffer.trim());
        lineBuffer = '';
      }

      if (signal !== 'SIGINT' && signal !== 'SIGKILL' && code !== 0 && code !== null) {
        const detail = stderrBuffer.trim() || `code ${code}`;
        this.emit(worktreePath, {
          type: 'error',
          message: `Claude error: ${detail}`,
        });
      }
    });
  }

  stop(worktreePath: string): void {
    const entry = this.sessions.get(worktreePath);
    if (entry?.currentProc?.pid) {
      entry.currentProc.kill('SIGINT');
    }
  }

  newChat(worktreePath: string): void {
    const entry = this.sessions.get(worktreePath);
    if (entry?.currentProc) {
      entry.currentProc.kill();
    }
    this.sessions.delete(worktreePath);
  }

  killAll(): void {
    for (const entry of this.sessions.values()) {
      entry.currentProc?.kill();
    }
    this.sessions.clear();
  }

  private handleLine(worktreePath: string, line: string): void {
    let raw: RawClaudeEvent;
    try {
      raw = JSON.parse(line) as RawClaudeEvent;
    } catch {
      return;
    }

    if (raw.type === 'system') {
      // Extract session_id for conversation continuity
      if (raw.session_id) {
        const entry = this.sessions.get(worktreePath);
        if (entry) entry.sessionId = raw.session_id;
      }
      return;
    }

    if (raw.type === 'assistant') {
      for (const block of raw.message.content ?? []) {
        if (block.type === 'text') {
          this.emit(worktreePath, { type: 'text', text: block.text });
        } else if (block.type === 'thinking') {
          this.emit(worktreePath, { type: 'thinking', thinking: block.thinking });
        } else if (block.type === 'tool_use') {
          this.emit(worktreePath, {
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: block.input,
          });
        }
      }
      return;
    }

    if (raw.type === 'tool_result') {
      this.emit(worktreePath, {
        type: 'tool_result',
        toolUseId: raw.tool_use_id,
        content: raw.content,
        isError: raw.is_error ?? false,
      });
      return;
    }

    if (raw.type === 'result') {
      if (raw.is_error && raw.error) {
        this.emit(worktreePath, { type: 'error', message: String(raw.error) });
      } else {
        this.emit(worktreePath, {
          type: 'result',
          costUsd: raw.total_cost_usd ?? 0,
          durationMs: raw.duration_ms ?? 0,
          turns: raw.num_turns ?? 1,
        });
      }
      return;
    }

    if (raw.type === 'error') {
      const msg =
        typeof raw.error === 'string'
          ? raw.error
          : raw.error?.message ?? raw.message ?? 'Unknown error';
      this.emit(worktreePath, { type: 'error', message: msg });
      return;
    }
  }

  private emit(worktreePath: string, event: ClaudeDisplayEvent): void {
    if (!this.win.isDestroyed()) {
      this.win.webContents.send('claude:event', { worktreePath, event });
    }
  }
}
