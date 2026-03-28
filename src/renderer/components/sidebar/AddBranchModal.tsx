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

  const [worktreesDir, setWorktreesDir] = useState<string | null | 'loading'>('loading');
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [repoRootPath, setRepoRootPath] = useState<string | null>(null);
  const [defaultBranch, setDefaultBranch] = useState('');
  const [branchName, setBranchName] = useState('');
  const [repoError, setRepoError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const defaultBranchRef = useRef<HTMLInputElement>(null);
  const branchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.relay
      .invoke('settings:get-worktrees-dir')
      .then((dir) => setWorktreesDir((dir as string | null) ?? null))
      .catch(() => setWorktreesDir(null));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSetWorktreesDir() {
    const selected = (await window.relay.invoke('dialog:open-folder')) as string | null;
    if (selected) {
      await window.relay.invoke('settings:set-worktrees-dir', { dir: selected });
      setWorktreesDir(selected);
    }
  }

  async function handleSelectFolder() {
    const selected = (await window.relay.invoke('dialog:open-folder')) as string | null;
    if (!selected) return;
    setFolderPath(selected);
    setRepoRootPath(null);
    setRepoError('');
    try {
      const info = (await window.relay.invoke('git:get-repo-info', { folderPath: selected })) as {
        repoRootPath: string;
        repoName: string;
        defaultBranch: string | null;
      };
      setRepoRootPath(info.repoRootPath);
      if (info.defaultBranch) {
        setDefaultBranch(info.defaultBranch);
        branchInputRef.current?.focus();
      } else {
        setDefaultBranch('');
        defaultBranchRef.current?.focus();
      }
    } catch {
      setRepoError('Not a git repository');
    }
  }

  const isValid =
    worktreesDir !== null &&
    worktreesDir !== 'loading' &&
    !!repoRootPath &&
    defaultBranch.length > 0 &&
    VALID_BRANCH.test(defaultBranch) &&
    branchName.length > 0 &&
    VALID_BRANCH.test(branchName);

  async function handleConfirm() {
    if (!isValid || !folderPath) return;
    setLoading(true);
    setError('');
    try {
      await addBranchToGroup(groupId, folderPath, branchName, defaultBranch);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add worktree');
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
        <h2 className="text-[14px] font-semibold text-[var(--color-mac-text)] mb-4">Add worktree</h2>

        {/* Worktrees directory */}
        <label className="block text-[12px] text-[var(--color-mac-muted)] mb-1">Worktrees directory</label>
        <div className="flex items-center gap-2 mb-3">
          <div
            className={`flex-1 px-3 py-1.5 text-[13px] rounded border truncate ${
              worktreesDir && worktreesDir !== 'loading'
                ? 'bg-[var(--color-mac-bg)] border-[var(--color-mac-border)] text-[var(--color-mac-text)]'
                : 'bg-[var(--color-mac-bg)] border-orange-500/60 text-orange-400'
            }`}
          >
            {worktreesDir === 'loading' ? '…' : worktreesDir ? basename(worktreesDir) : 'Not set — required'}
          </div>
          <button
            onClick={handleSetWorktreesDir}
            disabled={loading}
            className="px-2 py-1.5 text-[12px] rounded border border-[var(--color-mac-border)] text-[var(--color-mac-muted)] hover:text-[var(--color-mac-text)] hover:border-[var(--color-mac-accent)] transition-colors shrink-0 disabled:opacity-50"
          >
            {worktreesDir && worktreesDir !== 'loading' ? 'Change' : 'Set'}
          </button>
        </div>

        {/* Repository */}
        <label className="block text-[12px] text-[var(--color-mac-muted)] mb-1">Repository</label>
        <button
          onClick={handleSelectFolder}
          disabled={loading || !worktreesDir || worktreesDir === 'loading'}
          className="w-full text-left px-3 py-1.5 text-[13px] rounded bg-[var(--color-mac-bg)] border border-[var(--color-mac-border)] text-[var(--color-mac-text)] hover:border-[var(--color-mac-accent)] transition-colors mb-1 truncate disabled:opacity-50"
        >
          {repoDisplayName ?? <span className="text-[var(--color-mac-muted)]">Select folder…</span>}
        </button>
        {repoError && <p className="text-[11px] text-red-400 mb-2" style={{ userSelect: 'text' }}>{repoError}</p>}
        {!repoError && <div className="mb-2" />}

        {/* Default branch */}
        <label className="block text-[12px] text-[var(--color-mac-muted)] mb-1">Default branch</label>
        <input
          ref={defaultBranchRef}
          type="text"
          value={defaultBranch}
          onChange={(e) => { setDefaultBranch(e.target.value); setError(''); }}
          onKeyDown={handleKeyDown}
          placeholder="main"
          className="w-full px-3 py-1.5 text-[13px] rounded bg-[var(--color-mac-bg)] border border-[var(--color-mac-border)] text-[var(--color-mac-text)] outline-none focus:border-[var(--color-mac-accent)] mb-3"
          style={{ userSelect: 'text' }}
          disabled={loading || !repoRootPath}
        />

        {/* New branch name */}
        <label className="block text-[12px] text-[var(--color-mac-muted)] mb-1">New branch name</label>
        <input
          ref={branchInputRef}
          type="text"
          value={branchName}
          onChange={(e) => { setBranchName(e.target.value); setError(''); }}
          onKeyDown={handleKeyDown}
          placeholder="feature/my-feature"
          className="w-full px-3 py-1.5 text-[13px] rounded bg-[var(--color-mac-bg)] border border-[var(--color-mac-border)] text-[var(--color-mac-text)] outline-none focus:border-[var(--color-mac-accent)] mb-4"
          style={{ userSelect: 'text' }}
          disabled={loading || !repoRootPath}
        />

        {error && <p className="text-[12px] text-red-400 mb-3" style={{ userSelect: 'text' }}>{error}</p>}

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
            {loading ? 'Creating…' : 'Add worktree'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
