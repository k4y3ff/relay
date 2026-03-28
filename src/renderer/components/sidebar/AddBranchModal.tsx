import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRepo } from '../../context/RepoContext';

function basename(p: string) {
  return p.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? p;
}

interface AddBranchModalProps {
  groupId: string;
  onClose: () => void;
}

const VALID_BRANCH = /^[a-zA-Z0-9._\-/]+$/;

export default function AddBranchModal({ groupId, onClose }: AddBranchModalProps) {
  const { addBranchToGroup } = useRepo();
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [branchName, setBranchName] = useState('');
  const [createNew, setCreateNew] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const branchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Focus branch input once a folder is selected
  useEffect(() => {
    if (folderPath) branchInputRef.current?.focus();
  }, [folderPath]);

  async function handleSelectFolder() {
    const selected = (await window.relay.invoke('dialog:open-folder')) as string | null;
    if (selected) {
      setFolderPath(selected);
      setError('');
    }
  }

  const isValid = !!folderPath && branchName.length > 0 && VALID_BRANCH.test(branchName);

  async function handleConfirm() {
    if (!isValid || !folderPath) return;
    setLoading(true);
    setError('');
    try {
      await addBranchToGroup(groupId, folderPath, branchName, createNew);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add branch');
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && isValid && !loading) handleConfirm();
  }

  const repoDisplayName = folderPath ? basename(folderPath) : null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-mac-surface)] border border-[var(--color-mac-border)] rounded-lg shadow-2xl p-5 w-80"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[14px] font-semibold text-[var(--color-mac-text)] mb-4">Add branch</h2>

        <label className="block text-[12px] text-[var(--color-mac-muted)] mb-1">Repository</label>
        <button
          onClick={handleSelectFolder}
          disabled={loading}
          className="w-full text-left px-3 py-1.5 text-[13px] rounded bg-[var(--color-mac-bg)] border border-[var(--color-mac-border)] text-[var(--color-mac-text)] hover:border-[var(--color-mac-accent)] transition-colors mb-3 truncate disabled:opacity-50"
        >
          {repoDisplayName ?? <span className="text-[var(--color-mac-muted)]">Select folder…</span>}
        </button>

        <label className="block text-[12px] text-[var(--color-mac-muted)] mb-1">Branch name</label>
        <input
          ref={branchInputRef}
          type="text"
          value={branchName}
          onChange={(e) => { setBranchName(e.target.value); setError(''); }}
          onKeyDown={handleKeyDown}
          placeholder="feature/my-feature"
          className="w-full px-3 py-1.5 text-[13px] rounded bg-[var(--color-mac-bg)] border border-[var(--color-mac-border)] text-[var(--color-mac-text)] outline-none focus:border-[var(--color-mac-accent)] mb-3"
          style={{ userSelect: 'text' }}
          disabled={loading || !folderPath}
        />

        <label className="flex items-center gap-2 text-[13px] text-[var(--color-mac-text)] mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={createNew}
            onChange={(e) => setCreateNew(e.target.checked)}
            disabled={loading}
            className="accent-[var(--color-mac-accent)]"
          />
          Create new branch
        </label>

        {error && (
          <p className="text-[12px] text-red-400 mb-3">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-3 py-1.5 text-[13px] rounded text-[var(--color-mac-muted)] hover:text-[var(--color-mac-text)] hover:bg-[var(--color-mac-surface2)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid || loading}
            className="px-3 py-1.5 text-[13px] rounded bg-[var(--color-mac-accent)] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {loading ? 'Creating…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
