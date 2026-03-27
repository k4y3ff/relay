import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useCallback,
  ReactNode,
} from 'react';
import type {
  ChatMessage,
  ChatSession,
  ClaudeStreamEvent,
  DiffViewState,
  FileEditBanner,
  PersistedChatSession,
  StreamEventEnvelope,
  AssistantTextMessage,
  ThinkingBlock,
  ToolCallMessage,
  ErrorMessage,
} from '../types/chat';
import { useRepo } from './RepoContext';

// ── Helpers ─────────────────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID();
}

function isAuthError(text: string): boolean {
  return /not logged in|authentication|unauthorized|login/i.test(text);
}

function extractToolResultText(
  content: ClaudeStreamEvent['content']
): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  return content
    .map((c) => (c.type === 'text' ? (c.text ?? '') : ''))
    .join('\n');
}

function emptySession(worktreePath: string): ChatSession {
  return { worktreePath, messages: [], isStreaming: false, messageCount: 0 };
}

// ── State ────────────────────────────────────────────────────────────────────

interface ChatState {
  sessions: Map<string, ChatSession>;
  diffView: DiffViewState | null;
  claudeAvailable: boolean | null;
}

type ChatAction =
  | { type: 'LOAD_SESSION'; session: PersistedChatSession }
  | { type: 'ADD_USER_MESSAGE'; worktreePath: string; message: ChatMessage }
  | { type: 'SET_STREAMING'; worktreePath: string; streaming: boolean }
  | { type: 'STREAM_EVENT'; worktreePath: string; event: ClaudeStreamEvent }
  | { type: 'NEW_CHAT'; worktreePath: string }
  | { type: 'INSERT_FILE_EDIT_BANNER'; worktreePath: string; banner: FileEditBanner }
  | { type: 'OPEN_DIFF'; state: DiffViewState }
  | { type: 'CLOSE_DIFF' }
  | { type: 'SET_CLAUDE_AVAILABLE'; available: boolean };

function applyStreamEvent(session: ChatSession, event: ClaudeStreamEvent): ChatSession {
  const msgs = session.messages;

  // assistant text delta
  if (event.type === 'assistant' && event.subtype === 'text' && event.text !== undefined) {
    const last = msgs[msgs.length - 1];
    if (last && last.type === 'assistant_text' && !last.complete) {
      const updated: AssistantTextMessage = { ...last, text: last.text + event.text };
      return { ...session, messages: [...msgs.slice(0, -1), updated], isStreaming: true };
    }
    const newMsg: AssistantTextMessage = {
      id: uuid(), type: 'assistant_text', text: event.text, complete: false, timestamp: Date.now(),
    };
    return { ...session, messages: [...msgs, newMsg], isStreaming: true };
  }

  // thinking delta
  if (event.type === 'assistant' && event.subtype === 'thinking' && event.thinking !== undefined) {
    const last = msgs[msgs.length - 1];
    if (last && last.type === 'thinking' && !last.complete) {
      const updated: ThinkingBlock = { ...last, text: last.text + event.thinking };
      return { ...session, messages: [...msgs.slice(0, -1), updated], isStreaming: true };
    }
    const newMsg: ThinkingBlock = {
      id: uuid(), type: 'thinking', text: event.thinking, complete: false, timestamp: Date.now(),
    };
    return { ...session, messages: [...msgs, newMsg], isStreaming: true };
  }

  // tool_use
  if (event.type === 'tool_use' && event.id && event.name) {
    const newMsg: ToolCallMessage = {
      id: uuid(),
      type: 'tool_call',
      toolUseId: event.id,
      toolName: event.name,
      input: event.input ?? {},
      result: null,
      timestamp: Date.now(),
    };
    return { ...session, messages: [...msgs, newMsg], isStreaming: true };
  }

  // tool_result
  if (event.type === 'tool_result' && event.tool_use_id) {
    const resultText = extractToolResultText(event.content);
    const updated = msgs.map((m) =>
      m.type === 'tool_call' && m.toolUseId === event.tool_use_id
        ? { ...m, result: resultText }
        : m
    );
    return { ...session, messages: updated };
  }

  // result — turn complete
  if (event.type === 'result') {
    const completed = msgs.map((m) => {
      if ((m.type === 'assistant_text' || m.type === 'thinking') && !m.complete) {
        return { ...m, complete: true };
      }
      return m;
    });
    return { ...session, messages: completed, isStreaming: false, messageCount: session.messageCount + 1 };
  }

  // error
  if (event.type === 'error' || event.type === 'system') {
    const text = event.message ?? 'An error occurred';
    const newMsg: ErrorMessage = {
      id: uuid(), type: 'error', text, isAuthError: isAuthError(text), timestamp: Date.now(),
    };
    return { ...session, messages: [...msgs, newMsg], isStreaming: false };
  }

  return session;
}

function reducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'LOAD_SESSION': {
      const s = action.session;
      const sessions = new Map(state.sessions);
      sessions.set(s.worktreePath, {
        worktreePath: s.worktreePath,
        messages: s.messages,
        isStreaming: false,
        messageCount: s.messageCount,
      });
      return { ...state, sessions };
    }
    case 'ADD_USER_MESSAGE': {
      const sessions = new Map(state.sessions);
      const existing = sessions.get(action.worktreePath) ?? emptySession(action.worktreePath);
      sessions.set(action.worktreePath, {
        ...existing,
        messages: [...existing.messages, action.message],
        isStreaming: true,
      });
      return { ...state, sessions };
    }
    case 'SET_STREAMING': {
      const sessions = new Map(state.sessions);
      const existing = sessions.get(action.worktreePath) ?? emptySession(action.worktreePath);
      sessions.set(action.worktreePath, { ...existing, isStreaming: action.streaming });
      return { ...state, sessions };
    }
    case 'STREAM_EVENT': {
      const sessions = new Map(state.sessions);
      const existing = sessions.get(action.worktreePath) ?? emptySession(action.worktreePath);
      sessions.set(action.worktreePath, applyStreamEvent(existing, action.event));
      return { ...state, sessions };
    }
    case 'NEW_CHAT': {
      const sessions = new Map(state.sessions);
      sessions.set(action.worktreePath, emptySession(action.worktreePath));
      return { ...state, sessions };
    }
    case 'INSERT_FILE_EDIT_BANNER': {
      const sessions = new Map(state.sessions);
      const existing = sessions.get(action.worktreePath) ?? emptySession(action.worktreePath);
      sessions.set(action.worktreePath, {
        ...existing,
        messages: [...existing.messages, action.banner],
      });
      return { ...state, sessions };
    }
    case 'OPEN_DIFF':
      return { ...state, diffView: action.state };
    case 'CLOSE_DIFF':
      return { ...state, diffView: null };
    case 'SET_CLAUDE_AVAILABLE':
      return { ...state, claudeAvailable: action.available };
    default:
      return state;
  }
}

const initialState: ChatState = {
  sessions: new Map(),
  diffView: null,
  claudeAvailable: null,
};

// ── Context ──────────────────────────────────────────────────────────────────

interface ChatContextValue extends ChatState {
  sendMessage: (worktreePath: string, text: string) => Promise<void>;
  newChat: (worktreePath: string) => Promise<void>;
  stopStreaming: (worktreePath: string) => void;
  openDiff: (worktreePath: string, filePath: string) => Promise<void>;
  closeDiff: () => void;
  insertFileEditBanner: (worktreePath: string, banner: FileEditBanner) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { activeWorktreePath } = useRepo();

  // Validate claude on mount
  useEffect(() => {
    window.relay
      .invoke('claude:validate')
      .then((result) => {
        const { ok } = result as { ok: boolean };
        dispatch({ type: 'SET_CLAUDE_AVAILABLE', available: ok });
      })
      .catch(() => dispatch({ type: 'SET_CLAUDE_AVAILABLE', available: false }));
  }, []);

  // Subscribe to streaming events from main process
  useEffect(() => {
    const handler = (envelope: unknown) => {
      const { worktreePath, event } = envelope as StreamEventEnvelope;
      dispatch({ type: 'STREAM_EVENT', worktreePath, event });

      // Persist session after a completed turn
      if (event.type === 'result') {
        const session = state.sessions.get(worktreePath);
        if (session) {
          const persisted: PersistedChatSession = {
            worktreePath: session.worktreePath,
            messages: session.messages,
            messageCount: session.messageCount + 1,
          };
          window.relay.invoke('chat:sessions:save', { session: persisted }).catch(() => {});
        }
      }
    };
    window.relay.on('claude:stream-event', handler);
    return () => window.relay.off('claude:stream-event', handler);
  }, [state.sessions]);

  // Load session when active worktree changes
  useEffect(() => {
    if (!activeWorktreePath) return;
    if (state.sessions.has(activeWorktreePath)) return;
    window.relay
      .invoke('chat:sessions:load', { worktreePath: activeWorktreePath })
      .then((result) => {
        if (result) {
          dispatch({ type: 'LOAD_SESSION', session: result as PersistedChatSession });
        }
      })
      .catch(() => {});
  }, [activeWorktreePath]);

  const sendMessage = useCallback(async (worktreePath: string, text: string) => {
    const userMsg: ChatMessage = {
      id: uuid(),
      type: 'user',
      text,
      timestamp: Date.now(),
    };
    dispatch({ type: 'ADD_USER_MESSAGE', worktreePath, message: userMsg });
    await window.relay.invoke('claude:send-message', { worktreePath, text });
  }, []);

  const newChat = useCallback(async (worktreePath: string) => {
    await window.relay.invoke('claude:new-chat', { worktreePath });
    dispatch({ type: 'NEW_CHAT', worktreePath });
  }, []);

  const stopStreaming = useCallback((worktreePath: string) => {
    window.relay.invoke('claude:stop', { worktreePath }).catch(() => {});
  }, []);

  const openDiff = useCallback(async (worktreePath: string, filePath: string) => {
    const diff = (await window.relay.invoke('claude:get-diff', { worktreePath, filePath })) as string;
    dispatch({ type: 'OPEN_DIFF', state: { worktreePath, filePath, diff } });
  }, []);

  const closeDiff = useCallback(() => {
    dispatch({ type: 'CLOSE_DIFF' });
  }, []);

  const insertFileEditBanner = useCallback(
    (worktreePath: string, banner: FileEditBanner) => {
      dispatch({ type: 'INSERT_FILE_EDIT_BANNER', worktreePath, banner });
    },
    []
  );

  return (
    <ChatContext.Provider
      value={{
        ...state,
        sendMessage,
        newChat,
        stopStreaming,
        openDiff,
        closeDiff,
        insertFileEditBanner,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
