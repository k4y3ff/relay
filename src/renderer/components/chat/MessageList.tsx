import { useEffect, useRef } from 'react';
import type { ChatMessage, ToolResultMessage } from '../../types/chat';
import MessageBubble from './MessageBubble';
import AssistantBlock from './AssistantBlock';
import ToolCallCard from './ToolCallCard';
import ResultFooter from './ResultFooter';
import ErrorBanner from './ErrorBanner';
import FileEditBanner from './FileEditBanner';

interface Props {
  messages: ChatMessage[];
  streaming: boolean;
}

export default function MessageList({ messages, streaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Track whether user has scrolled away from the bottom
  const userScrolledRef = useRef(false);

  // Reset scroll lock when streaming starts
  useEffect(() => {
    if (streaming) userScrolledRef.current = false;
  }, [streaming]);

  // Auto-scroll to bottom while streaming (unless user scrolled up)
  useEffect(() => {
    if (!streaming || userScrolledRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [messages, streaming]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (!atBottom) userScrolledRef.current = true;
    else userScrolledRef.current = false;
  };

  // Build a lookup map for tool results so ToolCallCard can receive them
  const toolResults = new Map<string, ToolResultMessage>();
  for (const msg of messages) {
    if (msg.role === 'tool_result') {
      toolResults.set(msg.toolUseId, msg);
    }
  }

  if (messages.length === 0) {
    return (
      <div className="message-list message-list-empty">
        <span className="pane-placeholder">Send a message to start chatting</span>
      </div>
    );
  }

  return (
    <div className="message-list" ref={containerRef} onScroll={handleScroll}>
      {messages.map((msg) => {
        switch (msg.role) {
          case 'user':
            return <MessageBubble key={msg.id} message={msg} />;
          case 'assistant':
            return <AssistantBlock key={msg.id} message={msg} />;
          case 'tool_use':
            return (
              <ToolCallCard
                key={msg.id}
                message={msg}
                result={toolResults.get(msg.toolUseId)}
              />
            );
          case 'tool_result':
            // Rendered inline in ToolCallCard — skip standalone rendering
            return null;
          case 'result':
            return <ResultFooter key={msg.id} message={msg} />;
          case 'error':
            return <ErrorBanner key={msg.id} message={msg} />;
          case 'file_edit_banner':
            return <FileEditBanner key={msg.id} message={msg} />;
          default:
            return null;
        }
      })}
      <div ref={bottomRef} />
    </div>
  );
}
