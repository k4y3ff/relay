import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  ReactNode,
} from 'react';
import type {
  ChatMessage,
  ChatSession,
  ClaudeDisplayEvent,
  AssistantMessage,
} from '../types/chat';

// ── State ───────────────────────────────────────────────────────────────────

interface ChatState {
  sessions: Map<string, ChatSession>;
  claudeInstalled: boolean;
}

type Action =
  | { type: 'SET_INSTALLED'; installed: boolean }
  | { type: 'RESTORE_SESSION'; worktreePath: string; messages: ChatMessage[] }
  | { type: 'APPEND_USER_MESSAGE'; worktreePath: string; message: ChatMessage }
  | { type: 'SET_STREAMING'; worktreePath: string; streaming: boolean }
  | { type: 'SET_ASSISTANT_TEXT'; worktreePath: string; text: string }
  | { type: 'SET_ASSISTANT_THINKING'; worktreePath: string; thinking: string }
  | { type: 'UPSERT_TOOL_USE'; worktreePath: string; message: ChatMessage }
  | { type: 'RESOLVE_TOOL_USE'; worktreePath: string; toolUseId: string }
  | { type: 'APPEND_MESSAGE'; worktreePath: string; message: ChatMessage }
  | { type: 'NEW_CHAT'; worktreePath: string };

function getOrCreateSession(state: ChatState, worktreePath: string): ChatSession {
  return (
    state.sessions.get(worktreePath) ?? {
      worktreePath,
      messages: [],
      streaming: false,
    }
  );
}

function updateSession(
  state: ChatState,
  worktreePath: string,
  updater: (session: ChatSession) => ChatSession
): ChatState {
  const current = getOrCreateSession(state, worktreePath);
  const updated = updater(current);
  const next = new Map(state.sessions);
  next.set(worktreePath, updated);
  return { ...state, sessions: next };
}

function reducer(state: ChatState, action: Action): ChatState {
  switch (action.type) {
    case 'SET_INSTALLED':
      return { ...state, claudeInstalled: action.installed };

    case 'RESTORE_SESSION':
      return updateSession(state, action.worktreePath, (s) => ({
        ...s,
        messages: action.messages,
        streaming: false,
      }));

    case 'APPEND_USER_MESSAGE':
    case 'APPEND_MESSAGE':
      return updateSession(state, action.worktreePath, (s) => ({
        ...s,
        messages: [...s.messages, action.message],
      }));

    case 'SET_STREAMING':
      return updateSession(state, action.worktreePath, (s) => ({
        ...s,
        streaming: action.streaming,
      }));

    case 'SET_ASSISTANT_TEXT': {
      return updateSession(state, action.worktreePath, (s) => {
        const messages = [...s.messages];
        const lastIdx = messages.length - 1;
        const last = messages[lastIdx];
        if (last && last.role === 'assistant') {
          messages[lastIdx] = { ...last, text: action.text } as AssistantMessage;
        } else {
          messages.push({
            id: crypto.randomUUID(),
            role: 'assistant',
            text: action.text,
            thinking: '',
          } as AssistantMessage);
        }
        return { ...s, messages };
      });
    }

    case 'SET_ASSISTANT_THINKING': {
      return updateSession(state, action.worktreePath, (s) => {
        const messages = [...s.messages];
        const lastIdx = messages.length - 1;
        const last = messages[lastIdx];
        if (last && last.role === 'assistant') {
          messages[lastIdx] = { ...last, thinking: action.thinking } as AssistantMessage;
        } else {
          messages.push({
            id: crypto.randomUUID(),
            role: 'assistant',
            text: '',
            thinking: action.thinking,
          } as AssistantMessage);
        }
        return { ...s, messages };
      });
    }

    case 'UPSERT_TOOL_USE': {
      return updateSession(state, action.worktreePath, (s) => {
        const messages = [...s.messages];
        const existingIdx = messages.findIndex(
          (m) => m.role === 'tool_use' && m.id === action.message.id
        );
        if (existingIdx >= 0) {
          messages[existingIdx] = action.message;
        } else {
          messages.push(action.message);
        }
        return { ...s, messages };
      });
    }

    case 'RESOLVE_TOOL_USE': {
      return updateSession(state, action.worktreePath, (s) => {
        const messages = s.messages.map((m) =>
          m.role === 'tool_use' && m.toolUseId === action.toolUseId
            ? { ...m, pending: false }
            : m
        );
        return { ...s, messages };
      });
    }

    case 'NEW_CHAT':
      return updateSession(state, action.worktreePath, () => ({
        worktreePath: action.worktreePath,
        messages: [],
        streaming: false,
      }));

    default:
      return state;
  }
}

const initialState: ChatState = {
  sessions: new Map(),
  claudeInstalled: true, // optimistic; validated on mount
};

// ── Context ─────────────────────────────────────────────────────────────────

interface ChatContextValue {
  session: (worktreePath: string | null) => ChatSession | null;
  claudeInstalled: boolean;
  sendMessage: (worktreePath: string, text: string) => void;
  stopStreaming: (worktreePath: string) => void;
  newChat: (worktreePath: string) => void;
  appendFileEditBanner: (worktreePath: string, filePaths: string[]) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

// ── Provider ────────────────────────────────────────────────────────────────

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Debounce timer ref for session persistence
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Validate claude on mount and load persisted sessions
  useEffect(() => {
    window.relay.invoke('claude:validate').then((result) => {
      const { installed } = result as { installed: boolean };
      dispatch({ type: 'SET_INSTALLED', installed });
    }).catch(() => {
      dispatch({ type: 'SET_INSTALLED', installed: false });
    });

    window.relay.invoke('claude:load-sessions').then((sessions) => {
      const sessionsMap = sessions as Record<string, ChatMessage[]>;
      for (const [worktreePath, messages] of Object.entries(sessionsMap)) {
        dispatch({ type: 'RESTORE_SESSION', worktreePath, messages });
      }
    }).catch(() => { /* ignore */ });
  }, []);

  // Subscribe to claude:event from main process
  useEffect(() => {
    const handler = (payload: unknown) => {
      const { worktreePath, event } = payload as {
        worktreePath: string;
        event: ClaudeDisplayEvent;
      };
      switch (event.type) {
        case 'text':
          dispatch({ type: 'SET_ASSISTANT_TEXT', worktreePath, text: event.text });
          break;
        case 'thinking':
          dispatch({ type: 'SET_ASSISTANT_THINKING', worktreePath, thinking: event.thinking });
          break;
        case 'tool_use':
          dispatch({
            type: 'UPSERT_TOOL_USE',
            worktreePath,
            message: {
              id: event.id,
              role: 'tool_use',
              toolUseId: event.id,
              toolName: event.name,
              input: event.input,
              pending: true,
            },
          });
          break;
        case 'tool_result':
          dispatch({ type: 'RESOLVE_TOOL_USE', worktreePath, toolUseId: event.toolUseId });
          dispatch({
            type: 'APPEND_MESSAGE',
            worktreePath,
            message: {
              id: crypto.randomUUID(),
              role: 'tool_result',
              toolUseId: event.toolUseId,
              content: event.content,
              isError: event.isError,
            },
          });
          break;
        case 'result':
          dispatch({
            type: 'APPEND_MESSAGE',
            worktreePath,
            message: {
              id: crypto.randomUUID(),
              role: 'result',
              costUsd: event.costUsd,
              durationMs: event.durationMs,
              turns: event.turns,
            },
          });
          dispatch({ type: 'SET_STREAMING', worktreePath, streaming: false });
          break;
        case 'error': {
          dispatch({
            type: 'APPEND_MESSAGE',
            worktreePath,
            message: {
              id: crypto.randomUUID(),
              role: 'error',
              text: event.message,
            },
          });
          dispatch({ type: 'SET_STREAMING', worktreePath, streaming: false });
          // Auto-focus terminal pane if it's an auth error
          if (/not authenticated|login/i.test(event.message)) {
            window.dispatchEvent(new CustomEvent('shell:focus'));
          }
          break;
        }
      }
    };

    window.relay.on('claude:event', handler);
    return () => window.relay.off('claude:event', handler);
  }, []);

  // Persist sessions to electron-store (debounced 500ms)
  useEffect(() => {
    if (persistTimerRef.current !== null) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      const sessionsObj: Record<string, ChatMessage[]> = {};
      for (const [path, session] of state.sessions.entries()) {
        sessionsObj[path] = session.messages;
      }
      window.relay.invoke('claude:persist-sessions', { sessions: sessionsObj }).catch(() => { /* ignore */ });
    }, 500);
    return () => {
      if (persistTimerRef.current !== null) clearTimeout(persistTimerRef.current);
    };
  }, [state.sessions]);

  const session = useCallback(
    (worktreePath: string | null): ChatSession | null => {
      if (!worktreePath) return null;
      return state.sessions.get(worktreePath) ?? null;
    },
    [state.sessions]
  );

  const sendMessage = useCallback((worktreePath: string, text: string) => {
    dispatch({
      type: 'APPEND_USER_MESSAGE',
      worktreePath,
      message: { id: crypto.randomUUID(), role: 'user', text },
    });
    dispatch({ type: 'SET_STREAMING', worktreePath, streaming: true });
    window.relay.invoke('claude:send', { worktreePath, text }).catch(() => { /* ignore */ });
  }, []);

  const stopStreaming = useCallback((worktreePath: string) => {
    window.relay.invoke('claude:stop', { worktreePath }).catch(() => { /* ignore */ });
  }, []);

  const newChat = useCallback((worktreePath: string) => {
    dispatch({ type: 'NEW_CHAT', worktreePath });
    window.relay.invoke('claude:new-chat', { worktreePath }).catch(() => { /* ignore */ });
  }, []);

  const appendFileEditBanner = useCallback((worktreePath: string, filePaths: string[]) => {
    dispatch({
      type: 'APPEND_MESSAGE',
      worktreePath,
      message: {
        id: crypto.randomUUID(),
        role: 'file_edit_banner',
        filePaths,
      },
    });
  }, []);

  return (
    <ChatContext.Provider
      value={{
        session,
        claudeInstalled: state.claudeInstalled,
        sendMessage,
        stopStreaming,
        newChat,
        appendFileEditBanner,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatSession(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatSession must be used within ChatProvider');
  return ctx;
}
