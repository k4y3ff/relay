import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRepo } from '../../context/RepoContext';

interface AddWorktreeModalProps {
  repoId: string;
  onClose: () => void;
}

const VALID_BRANCH = /^[a-zA-Z0-9._\-/]+$/;

export default function AddWorktreeModal({ repoId, onClose }: AddWorktreeModalProps) {
  const { addWorktree } = useRepo();
  const [branchName, setBranchName] = useState('');
  const [createNew, setCreateNew] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isValid = branchName.length > 0 && VALID_BRANCH.test(branchName);

  async function handleConfirm() {
    if (!isValid) return;
    setLoading(true);
    setError('');
    try {
      await addWorktree(repoId, branchName, createNew);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add worktree');
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && isValid && !loading) handleConfirm();
  }

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
        <h2 className="text-[14px] font-semibold text-[var(--color-mac-text)] mb-4">Add worktree</h2>

        <label className="block text-[12px] text-[var(--color-mac-muted)] mb-1">Branch name</label>
        <input
          ref={inputRef}
          type="text"
          value={branchName}
          onChange={(e) => { setBranchName(e.target.value); setError(''); }}
          onKeyDown={handleKeyDown}
          placeholder="feature/my-feature"
          className="w-full px-3 py-1.5 text-[13px] rounded bg-[var(--color-mac-bg)] border border-[var(--color-mac-border)] text-[var(--color-mac-text)] outline-none focus:border-[var(--color-mac-accent)] mb-3"
          style={{ userSelect: 'text' }}
          disabled={loading}
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
            className="px-3 py-1.5 text-[13px] rounded bg-[var(--color-mac-accent)] text-[var(--color-accent-text)] disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {loading ? 'Creating…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
