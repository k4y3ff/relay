import { useState, useRef, useCallback } from 'react';
import { useChat } from '../../context/ChatContext';

const LINE_HEIGHT = 22;
const MAX_LINES = 5;
const MAX_HEIGHT = LINE_HEIGHT * MAX_LINES + 16; // +padding

export default function ChatInput({ worktreePath }: { worktreePath: string }) {
  const { sessions, sendMessage, stopStreaming, newChat } = useChat();
  const session = sessions.get(worktreePath);
  const isStreaming = session?.isStreaming ?? false;
  const messageCount = session?.messageCount ?? 0;

  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resetHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, []);

  function handleInput() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, MAX_HEIGHT) + 'px';
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    setText('');
    resetHeight();
    await sendMessage(worktreePath, trimmed);
  }

  async function handleNewChat() {
    if (!window.confirm('Start a new chat? This will clear the current session.')) return;
    await newChat(worktreePath);
  }

  return (
    <div
      style={{
        flexShrink: 0,
        borderTop: '1px solid var(--color-mac-border)',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Meta row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12,
          color: 'var(--color-mac-muted)',
          userSelect: 'none',
        }}
      >
        <span>{messageCount > 0 ? `Session: ${messageCount} message${messageCount !== 1 ? 's' : ''}` : ''}</span>
        <button
          onClick={handleNewChat}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-mac-muted)',
            fontSize: 12,
            padding: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-mac-text)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-mac-muted)';
          }}
        >
          New chat
        </button>
      </div>

      {/* Input row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={isStreaming}
          placeholder={isStreaming ? 'Claude is responding…' : 'Message Claude (⌘↵ to send)'}
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            backgroundColor: 'var(--color-mac-surface2)',
            border: '1px solid var(--color-mac-border)',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 14,
            fontFamily: 'var(--font-sans)',
            color: 'var(--color-mac-text)',
            outline: 'none',
            lineHeight: `${LINE_HEIGHT}px`,
            minHeight: LINE_HEIGHT + 12,
            maxHeight: MAX_HEIGHT,
            overflowY: 'auto',
            userSelect: 'text',
            opacity: isStreaming ? 0.6 : 1,
          }}
        />
        {isStreaming ? (
          <button
            onClick={() => stopStreaming(worktreePath)}
            title="Stop"
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: '#f87171',
              userSelect: 'none',
            }}
          >
            ◼
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            title="Send (⌘↵)"
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: text.trim() ? 'var(--color-mac-accent)' : 'var(--color-mac-surface2)',
              border: '1px solid var(--color-mac-border)',
              cursor: text.trim() ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              color: text.trim() ? '#fff' : 'var(--color-mac-muted)',
              userSelect: 'none',
              transition: 'background-color 0.1s',
            }}
          >
            ↑
          </button>
        )}
      </div>
    </div>
  );
}
