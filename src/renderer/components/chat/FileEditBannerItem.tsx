import type { FileEditBanner } from '../../types/chat';
import { useChat } from '../../context/ChatContext';

export default function FileEditBannerItem({
  message,
  worktreePath,
}: {
  message: FileEditBanner;
  worktreePath: string;
}) {
  const { openDiff } = useChat();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        backgroundColor: 'var(--color-mac-surface2)',
        borderRadius: 6,
        fontSize: 13,
        userSelect: 'none',
      }}
    >
      <span style={{ color: 'var(--color-mac-muted)' }}>✎</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {message.filePath}
      </span>
      {message.additions > 0 && (
        <span style={{ color: '#4ade80', flexShrink: 0 }}>+{message.additions}</span>
      )}
      {message.deletions > 0 && (
        <span style={{ color: '#f87171', flexShrink: 0 }}>-{message.deletions}</span>
      )}
      <button
        onClick={() => openDiff(worktreePath, message.filePath)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-mac-accent)',
          fontSize: 13,
          padding: 0,
          flexShrink: 0,
        }}
      >
        View diff →
      </button>
    </div>
  );
}
