import { useState } from 'react';
import type { ThinkingBlock as ThinkingBlockType } from '../../types/chat';

export default function ThinkingBlock({ message }: { message: ThinkingBlockType }) {
  const [expanded, setExpanded] = useState(false);
  const label = message.complete ? 'Thought' : 'Thinking…';

  return (
    <div style={{ fontSize: 13 }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-mac-muted)',
          padding: '2px 0',
          fontStyle: 'italic',
          fontSize: 13,
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 11 }}>{expanded ? '▴' : '▾'}</span>
        <span>{label}</span>
      </button>
      {expanded && (
        <div
          style={{
            marginTop: 4,
            paddingLeft: 16,
            fontStyle: 'italic',
            color: 'var(--color-mac-muted)',
            fontSize: 13,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
          }}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
