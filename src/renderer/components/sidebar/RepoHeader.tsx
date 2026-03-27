import type { Repo } from '../../types/repo';
import { useRepo } from '../../context/RepoContext';
import OverflowMenu from './OverflowMenu';

interface RepoHeaderProps {
  repo: Repo;
  onAddWorktree: () => void;
}

function GitHubIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="text-[var(--color-mac-muted)] flex-shrink-0"
      aria-hidden="true"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export default function RepoHeader({ repo, onAddWorktree }: RepoHeaderProps) {
  const { collapsedRepos, toggleRepoCollapsed, removeRepo } = useRepo();
  const isCollapsed = collapsedRepos.has(repo.id);
  const isGitHub = repo.remote?.includes('github.com') ?? false;

  const menuItems = [
    { label: 'Add worktree', action: onAddWorktree },
    {
      label: 'Open in Finder',
      action: () => window.relay.invoke('shell:open-path', { path: repo.rootPath }),
    },
    { label: 'Remove from Relay', danger: true, action: () => removeRepo(repo.id) },
  ];

  return (
    <div
      className="group flex items-center gap-1.5 px-3 py-2 cursor-pointer select-none hover:bg-[var(--color-mac-surface2)] text-[var(--color-mac-text)]"
      onClick={() => toggleRepoCollapsed(repo.id)}
    >
      {/* Chevron */}
      <span
        className="text-[var(--color-mac-muted)] text-[10px] transition-transform duration-150 flex-shrink-0"
        style={{ display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
      >
        ▾
      </span>

      {/* GitHub icon */}
      {isGitHub && <GitHubIcon />}

      {/* Repo name */}
      <span className="flex-1 truncate text-[13px] font-medium">{repo.name}</span>

      {/* Overflow menu */}
      <OverflowMenu items={menuItems} />
    </div>
  );
}
