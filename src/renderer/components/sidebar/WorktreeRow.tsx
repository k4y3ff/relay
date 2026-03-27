import type { Worktree, Repo } from '../../types/repo';
import { useRepo } from '../../context/RepoContext';
import OverflowMenu from './OverflowMenu';

interface WorktreeRowProps {
  repo: Repo;
  worktree: Worktree;
}

export default function WorktreeRow({ repo, worktree }: WorktreeRowProps) {
  const { activeWorktreePath, selectWorktree, removeWorktree } = useRepo();
  const isActive = activeWorktreePath === worktree.path;

  const menuItems = [
    {
      label: 'Open in Finder',
      action: () => window.relay.invoke('shell:open-path', { path: worktree.path }),
    },
    {
      label: 'Copy path',
      action: () => navigator.clipboard.writeText(worktree.path),
    },
    {
      label: 'Remove worktree',
      danger: true,
      action: () => removeWorktree(repo.id, worktree.path),
    },
  ];

  return (
    <div
      title={worktree.path}
      onClick={() => selectWorktree(worktree.path)}
      className={`group flex items-center justify-between px-3 py-1.5 cursor-pointer text-[13px] select-none ${
        isActive
          ? 'worktree-row-active text-[var(--color-mac-text)]'
          : 'text-[var(--color-mac-muted)] hover:bg-[var(--color-mac-surface2)] hover:text-[var(--color-mac-text)]'
      }`}
    >
      <span className="truncate flex-1 ml-4">{worktree.branch}</span>
      <OverflowMenu items={menuItems} />
    </div>
  );
}
