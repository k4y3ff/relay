import { html as diff2htmlHtml } from 'diff2html';
import { useChat } from '../../context/ChatContext';

export default function DiffViewer() {
  const { diffView, closeDiff } = useChat();
  if (!diffView) return null;

  const diffHtml = diffView.diff
    ? diff2htmlHtml(diffView.diff, {
        drawFileList: false,
        matching: 'lines',
        outputFormat: 'line-by-line',
      })
    : '<p style="color:var(--color-mac-muted);padding:16px;font-size:13px">No diff available</p>';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          borderBottom: '1px solid var(--color-mac-border)',
          flexShrink: 0,
          fontSize: 13,
          userSelect: 'none',
        }}
      >
        <button
          onClick={closeDiff}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-mac-accent)',
            fontSize: 13,
            padding: 0,
          }}
        >
          ← Back to chat
        </button>
        <span style={{ color: 'var(--color-mac-muted)' }}>·</span>
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: 'var(--color-mac-text)',
          }}
        >
          {diffView.filePath}
        </span>
      </div>

      {/* Diff content */}
      <div
        className="diff2html-wrapper"
        style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}
        dangerouslySetInnerHTML={{ __html: diffHtml }}
      />
    </div>
  );
}
