import { useEffect, useRef } from 'react';
import { useChat } from '../../context/ChatContext';
import MessageItem from './MessageItem';

export default function MessageList({ worktreePath }: { worktreePath: string }) {
  const { sessions } = useChat();
  const session = sessions.get(worktreePath);
  const messages = session?.messages ?? [];
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(messages.length);

  useEffect(() => {
    if (messages.length !== prevLengthRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      prevLengthRef.current = messages.length;
    }
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-mac-muted)',
          fontSize: 13,
        }}
      >
        Send a message to start chatting with Claude
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 16px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        userSelect: 'text',
      }}
    >
      {messages.map((msg) => (
        <MessageItem key={msg.id} message={msg} worktreePath={worktreePath} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
