import { useCallback, useRef, KeyboardEvent } from 'react';

interface Props {
  streaming: boolean;
  messageCount: number;
  onSend: (text: string) => void;
  onStop: () => void;
  onNewChat: () => void;
}

export default function ChatInput({ streaming, messageCount, onSend, onStop, onNewChat }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    // Limit to ~8 lines (approx 192px at 24px line height)
    el.style.height = Math.min(el.scrollHeight, 192) + 'px';
  }, []);

  const submit = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const text = el.value.trim();
    if (!text) return;
    onSend(text);
    el.value = '';
    el.style.height = 'auto';
  }, [onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && e.metaKey) {
        e.preventDefault();
        submit();
      }
    },
    [submit]
  );

  const handleNewChat = useCallback(() => {
    if (messageCount === 0) {
      onNewChat();
      return;
    }
    if (window.confirm('Start a new chat? This will clear the current session.')) {
      onNewChat();
    }
  }, [messageCount, onNewChat]);

  return (
    <div className="chat-input-area">
      <div className="chat-input-row">
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          placeholder={streaming ? 'Claude is responding…' : 'Message Claude (⌘↵ to send)'}
          disabled={streaming}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          rows={3}
        />
      </div>
      <div className="chat-input-footer">
        <span className="chat-message-count">
          {messageCount > 0 ? `${messageCount} message${messageCount === 1 ? '' : 's'}` : ''}
        </span>
        <div className="chat-input-actions">
          <button
            className="chat-new-btn"
            onClick={handleNewChat}
            title="New chat"
          >
            New chat
          </button>
          {streaming ? (
            <button className="chat-stop-btn" onClick={onStop}>
              Stop
            </button>
          ) : (
            <button
              className="chat-send-btn"
              onClick={submit}
              title="Send (⌘↵)"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
