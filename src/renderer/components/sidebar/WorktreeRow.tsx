import { useEffect, useRef, useState } from 'react';
import type { Worktree, ChangedFile } from '../../types/repo';
import { useRepo } from '../../context/RepoContext';
import OverflowMenu from './OverflowMenu';

interface WorktreeRowProps {
  groupId: string;
  repoName: string;
  repoRootPath: string;
  worktree: Worktree;
}

export default function WorktreeRow({ groupId, repoName, repoRootPath, worktree }: WorktreeRowProps) {
  const { activeWorktreePath, selectWorktree, removeBranchFromGroup } = useRepo();
  const isActive = activeWorktreePath === worktree.path;
  const [stats, setStats] = useState<{ added: number; deleted: number; fileCount: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const files = (await window.relay.invoke('git:changed-files', {
          worktreePath: worktree.path,
        })) as ChangedFile[];
        if (files.length === 0) { setStats(null); return; }
        const added = files.reduce((s, f) => s + f.added, 0);
        const deleted = files.reduce((s, f) => s + f.deleted, 0);
        setStats({ added, deleted, fileCount: files.length });
      } catch {
        setStats(null);
      }
    };

    fetch();
    intervalRef.current = setInterval(fetch, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [worktree.path]);

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
      action: () => removeBranchFromGroup(groupId, worktree.path, repoRootPath),
    },
  ];

  return (
    <div
      title={worktree.path}
      onClick={() => selectWorktree(worktree.path)}
      style={{ height: 28, minHeight: 28 }}
      className={`group flex items-center justify-between px-3 cursor-pointer text-[13px] select-none ${
        isActive
          ? 'worktree-row-active text-[var(--color-mac-text)]'
          : 'text-[var(--color-mac-muted)] hover:bg-[var(--color-mac-surface2)] hover:text-[var(--color-mac-text)]'
      }`}
    >
      <span className="truncate flex-1 ml-4">{repoName} / {worktree.branch}</span>
      <div className="relative shrink-0 w-5 flex items-center justify-end">
        {stats && (
          <span className="absolute right-0 flex gap-1 text-[11px] font-mono whitespace-nowrap group-hover:hidden">
            {stats.added > 0 && <span style={{ color: '#4ade80' }}>+{stats.added}</span>}
            {stats.deleted > 0 && <span style={{ color: '#f87171' }}>-{stats.deleted}</span>}
            {stats.added === 0 && stats.deleted === 0 && (
              <span style={{ color: 'var(--color-mac-muted)' }}>{stats.fileCount}~</span>
            )}
          </span>
        )}
        <OverflowMenu items={menuItems} />
      </div>
    </div>
  );
}
