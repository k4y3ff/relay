import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage, AssistantTextMessage, UserMessage, ErrorMessage } from '../../types/chat';
import ToolCallCard from './ToolCallCard';
import ThinkingBlock from './ThinkingBlock';
import FileEditBannerItem from './FileEditBannerItem';

function UserBubble({ message }: { message: UserMessage }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div
        style={{
          maxWidth: '70%',
          backgroundColor: 'var(--color-mac-surface2)',
          borderRadius: 16,
          padding: '8px 14px',
          fontSize: 14,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          userSelect: 'text',
        }}
      >
        {message.text}
      </div>
    </div>
  );
}

function AssistantText({ message }: { message: AssistantTextMessage }) {
  return (
    <div
      className="assistant-text"
      style={{
        fontSize: 14,
        lineHeight: 1.6,
        color: 'var(--color-mac-text)',
        userSelect: 'text',
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ children, className, ...props }) {
            const isBlock = className?.startsWith('language-');
            if (isBlock) {
              return (
                <pre
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    backgroundColor: 'var(--color-mac-bg)',
                    borderRadius: 6,
                    padding: '10px 12px',
                    overflowX: 'auto',
                    margin: '8px 0',
                  }}
                >
                  <code {...props}>{children}</code>
                </pre>
              );
            }
            return (
              <code
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  backgroundColor: 'var(--color-mac-surface2)',
                  borderRadius: 4,
                  padding: '1px 5px',
                }}
                {...props}
              >
                {children}
              </code>
            );
          },
          p({ children }) {
            return <p style={{ margin: '4px 0' }}>{children}</p>;
          },
        }}
      >
        {message.text + (!message.complete ? '▋' : '')}
      </ReactMarkdown>
    </div>
  );
}

function ErrorBanner({ message }: { message: ErrorMessage }) {
  if (message.isAuthError) {
    return (
      <div
        style={{
          backgroundColor: 'rgba(234, 179, 8, 0.15)',
          border: '1px solid rgba(234, 179, 8, 0.4)',
          borderRadius: 6,
          padding: '10px 14px',
          fontSize: 13,
          color: '#fde68a',
          userSelect: 'text',
        }}
      >
        You're not logged in to Claude Code. Run{' '}
        <code
          style={{
            fontFamily: 'var(--font-mono)',
            backgroundColor: 'rgba(234, 179, 8, 0.2)',
            padding: '1px 5px',
            borderRadius: 3,
          }}
        >
          claude login
        </code>{' '}
        in the terminal below to authenticate, then try again.
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        border: '1px solid rgba(239, 68, 68, 0.4)',
        borderRadius: 6,
        padding: '10px 14px',
        fontSize: 13,
        color: '#fca5a5',
        userSelect: 'text',
        whiteSpace: 'pre-wrap',
      }}
    >
      {message.text}
    </div>
  );
}

export default function MessageItem({
  message,
  worktreePath,
}: {
  message: ChatMessage;
  worktreePath: string;
}) {
  switch (message.type) {
    case 'user':
      return <UserBubble message={message} />;
    case 'assistant_text':
      return <AssistantText message={message} />;
    case 'tool_call':
      return <ToolCallCard message={message} />;
    case 'thinking':
      return <ThinkingBlock message={message} />;
    case 'file_edit_banner':
      return <FileEditBannerItem message={message} worktreePath={worktreePath} />;
    case 'error':
      return <ErrorBanner message={message} />;
    default:
      return null;
  }
}
