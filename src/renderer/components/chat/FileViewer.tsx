import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css';
import { useEffect, useState } from 'react';

interface Props {
  worktreePath: string;
  filePath: string;
}

export default function FileViewer({ worktreePath, filePath }: Props) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    window.relay
      .invoke('fs:read-file', { worktreePath, filePath })
      .then((raw) => setContent(raw as string))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, [worktreePath, filePath]);

  const highlighted = (() => {
    if (!content) return null;
    const ext = filePath.split('.').pop() ?? '';
    return hljs.getLanguage(ext)
      ? hljs.highlight(content, { language: ext })
      : hljs.highlightAuto(content);
  })();

  return (
    <div className="diff-viewer">
      <div className="diff-viewer-header">
        <span className="diff-filepath">{filePath}</span>
      </div>
      <div className="diff-viewer-body">
        {loading && <div className="diff-loading">Loading…</div>}
        {error && <div className="diff-error">{error}</div>}
        {!loading && !error && (
          <pre className="file-viewer-content">
            {highlighted ? (
              <code dangerouslySetInnerHTML={{ __html: highlighted.value }} />
            ) : (
              content
            )}
          </pre>
        )}
      </div>
    </div>
  );
}
