// ── Claude CLI stream-json event types ─────────────────────────────────────

export interface ClaudeStreamEvent {
  type: string;
  // assistant text/thinking
  text?: string;
  thinking?: string;
  // tool_use
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  // tool_result
  tool_use_id?: string;
  content?: string | Array<{ type: string; text?: string }>;
  // result
  cost_usd?: number;
  duration_ms?: number;
  // error
  message?: string;
  // subtype for assistant events
  subtype?: string;
}

export interface StreamEventEnvelope {
  worktreePath: string;
  event: ClaudeStreamEvent;
}

// ── Chat message types ──────────────────────────────────────────────────────

export interface UserMessage {
  id: string;
  type: 'user';
  text: string;
  timestamp: number;
}

export interface AssistantTextMessage {
  id: string;
  type: 'assistant_text';
  text: string;
  complete: boolean;
  timestamp: number;
}

export interface ToolCallMessage {
  id: string;
  type: 'tool_call';
  toolUseId: string;
  toolName: string;
  input: Record<string, unknown>;
  result: string | null;
  timestamp: number;
}

export interface FileEditBanner {
  id: string;
  type: 'file_edit_banner';
  filePath: string;
  additions: number;
  deletions: number;
  timestamp: number;
}

export interface ThinkingBlock {
  id: string;
  type: 'thinking';
  text: string;
  complete: boolean;
  timestamp: number;
}

export interface ErrorMessage {
  id: string;
  type: 'error';
  text: string;
  isAuthError?: boolean;
  timestamp: number;
}

export type ChatMessage =
  | UserMessage
  | AssistantTextMessage
  | ToolCallMessage
  | FileEditBanner
  | ThinkingBlock
  | ErrorMessage;

// ── Session types ───────────────────────────────────────────────────────────

export interface ChatSession {
  worktreePath: string;
  messages: ChatMessage[];
  isStreaming: boolean;
  messageCount: number;
}

export interface PersistedChatSession {
  worktreePath: string;
  messages: ChatMessage[];
  messageCount: number;
}

// ── Diff mode ───────────────────────────────────────────────────────────────

export interface DiffViewState {
  worktreePath: string;
  filePath: string;
  diff: string;
}
