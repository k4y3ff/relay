import { useEffect, useState } from 'react';
import { html } from 'diff2html';
import 'diff2html/bundles/css/diff2html.min.css';
import { useRepo } from '../../context/RepoContext';

interface Props {
  worktreePath: string;
  filePath: string;
  status: string;
  added: number;
  deleted: number;
}

export default function DiffViewer({ worktreePath, filePath, status, added, deleted }: Props) {
  const { setActiveDiffFile } = useRepo();
  const [diffHtml, setDiffHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    window.relay
      .invoke('git:diff-file', { worktreePath, filePath, untracked: status === '?' })
      .then((rawDiff) => {
        const diffStr = rawDiff as string;
        if (!diffStr.trim()) {
          setError(`No diff output from git for: ${filePath}`);
          return;
        }
        try {
          setDiffHtml(html(diffStr, { drawFileList: false, outputFormat: 'line-by-line' }));
        } catch (e) {
          setError(`Failed to render diff: ${e instanceof Error ? e.message : String(e)}`);
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, [worktreePath, filePath, status]);

  return (
    <div className="diff-viewer">
      <div className="diff-viewer-header">
        <button className="diff-back-btn" onClick={() => setActiveDiffFile(null)}>
          ← Back to chat
        </button>
        <span className="diff-filepath">{filePath}</span>
        <span className="diff-counts">
          {added > 0 && <span className="diff-added">+{added}</span>}
          {deleted > 0 && <span className="diff-deleted"> -{deleted}</span>}
        </span>
      </div>

      <div className="diff-viewer-body">
        {loading && <div className="diff-loading">Loading diff…</div>}
        {error && <div className="diff-error">{error}</div>}
        {!loading && !error && (
          <div
            className="diff-content"
            dangerouslySetInnerHTML={{ __html: diffHtml }}
          />
        )}
      </div>
    </div>
  );
}
