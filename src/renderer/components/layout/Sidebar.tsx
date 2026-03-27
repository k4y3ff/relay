import { useState } from 'react';
import { useRepo } from '../../context/RepoContext';
import RepoSection from '../sidebar/RepoSection';
import AddWorktreeModal from '../sidebar/AddWorktreeModal';

export default function Sidebar() {
  const { repos, loading, addRepo } = useRepo();
  const [pendingAddWorktree, setPendingAddWorktree] = useState<string | null>(null);

  return (
    <div className="sidebar flex flex-col h-full">
      {/* Repo list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {loading && (
          <p className="text-[12px] text-[var(--color-mac-muted)] px-4 py-3">Loading…</p>
        )}
        {!loading && repos.length === 0 && (
          <p className="text-[12px] text-[var(--color-mac-muted)] text-center px-4 py-3">
            No repositories. Add one below.
          </p>
        )}
        {repos.map((repo) => (
          <RepoSection
            key={repo.id}
            repo={repo}
            onAddWorktree={(repoId) => setPendingAddWorktree(repoId)}
          />
        ))}
      </div>

      {/* Add repository button */}
      <div className="flex-shrink-0 border-t border-[var(--color-mac-border)] p-3">
        <button
          onClick={addRepo}
          className="w-full text-center text-[13px] text-[var(--color-mac-muted)] hover:text-[var(--color-mac-text)] px-2 py-1.5 rounded hover:bg-[var(--color-mac-surface2)] transition-colors"
        >
          + Add repository
        </button>
      </div>

      {/* Add worktree modal */}
      {pendingAddWorktree && (
        <AddWorktreeModal
          repoId={pendingAddWorktree}
          onClose={() => setPendingAddWorktree(null)}
        />
      )}
    </div>
  );
}
