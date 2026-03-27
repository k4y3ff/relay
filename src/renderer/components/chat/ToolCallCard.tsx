import { useState } from 'react';
import type { ToolCallMessage } from '../../types/chat';

const TOOL_LABELS: Record<string, string> = {
  Read: 'Read file',
  Write: 'Write file',
  Edit: 'Edit file',
  MultiEdit: 'Edit file',
  Bash: 'Run command',
  Glob: 'Find files',
  Grep: 'Search files',
  TodoWrite: 'Update task list',
  TodoRead: 'Update task list',
};

function Spinner() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 12,
        height: 12,
        border: '2px solid var(--color-mac-muted)',
        borderTopColor: 'var(--color-mac-accent)',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        flexShrink: 0,
      }}
    />
  );
}

export default function ToolCallCard({ message }: { message: ToolCallMessage }) {
  const [expanded, setExpanded] = useState(false);
  const label = TOOL_LABELS[message.toolName] ?? message.toolName;
  const pending = message.result === null;

  return (
    <div
      style={{
        border: '1px solid var(--color-mac-border)',
        borderRadius: 8,
        fontSize: 13,
        overflow: 'hidden',
        backgroundColor: 'var(--color-mac-bg)',
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          textAlign: 'left',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-mac-text)',
          userSelect: 'none',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor =
            'var(--color-mac-surface2)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
        }}
      >
        <span>🔧</span>
        <span style={{ flex: 1 }}>{label}</span>
        {pending ? (
          <Spinner />
        ) : (
          <span style={{ color: 'var(--color-mac-muted)', fontSize: 11 }}>
            {expanded ? '▴' : '▾'}
          </span>
        )}
      </button>
      {expanded && (
        <div
          style={{
            borderTop: '1px solid var(--color-mac-border)',
            padding: '8px 12px',
          }}
        >
          <pre
            style={{
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-mac-muted)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              margin: 0,
            }}
          >
            {JSON.stringify(message.input, null, 2)}
          </pre>
          {message.result && (
            <pre
              style={{
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-mac-text)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                marginTop: 8,
                margin: '8px 0 0',
              }}
            >
              {message.result}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
