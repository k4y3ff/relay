// ── Normalized events emitted by ClaudeManager → renderer ──────────────────

export type ClaudeDisplayEvent =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; toolUseId: string; content: unknown; isError: boolean }
  | { type: 'result'; costUsd: number; durationMs: number; turns: number }
  | { type: 'error'; message: string };

// ── Display message types ───────────────────────────────────────────────────

export interface UserMessage {
  id: string;
  role: 'user';
  text: string;
}

export interface AssistantMessage {
  id: string;
  role: 'assistant';
  text: string;
  thinking: string;
}

export interface ToolUseMessage {
  id: string;
  role: 'tool_use';
  toolUseId: string;
  toolName: string;
  input: Record<string, unknown>;
  pending: boolean;
}

export interface ToolResultMessage {
  id: string;
  role: 'tool_result';
  toolUseId: string;
  content: unknown;
  isError: boolean;
}

export interface ResultMessage {
  id: string;
  role: 'result';
  costUsd: number;
  durationMs: number;
  turns: number;
}

export interface ErrorMessage {
  id: string;
  role: 'error';
  text: string;
}

export interface FileEditBannerMessage {
  id: string;
  role: 'file_edit_banner';
  filePaths: string[];
}

export type ChatMessage =
  | UserMessage
  | AssistantMessage
  | ToolUseMessage
  | ToolResultMessage
  | ResultMessage
  | ErrorMessage
  | FileEditBannerMessage;

// ── Session ─────────────────────────────────────────────────────────────────

export interface ChatSession {
  worktreePath: string;
  messages: ChatMessage[];
  streaming: boolean;
}
