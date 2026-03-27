import { useEffect, useRef, useState } from 'react';
import type { Worktree, Repo, ChangedFile } from '../../types/repo';
import { useRepo } from '../../context/RepoContext';
import OverflowMenu from './OverflowMenu';

interface WorktreeRowProps {
  repo: Repo;
  worktree: Worktree;
}

export default function WorktreeRow({ repo, worktree }: WorktreeRowProps) {
  const { activeWorktreePath, selectWorktree, removeWorktree } = useRepo();
  const isActive = activeWorktreePath === worktree.path;
  const [stats, setStats] = useState<{ added: number; deleted: number; fileCount: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const files = (await window.relay.invoke('git:changed-files', {
          worktreePath: worktree.path,
        })) as ChangedFile[];
        console.log(`[WorktreeRow] ${worktree.branch}: ${files.length} files`, files);
        if (files.length === 0) { setStats(null); return; }
        const added = files.reduce((s, f) => s + f.added, 0);
        const deleted = files.reduce((s, f) => s + f.deleted, 0);
        setStats({ added, deleted, fileCount: files.length });
      } catch (e) {
        console.error(`[WorktreeRow] ${worktree.branch} error:`, e);
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
      {stats && (
        <span className="flex gap-1 text-[11px] font-mono mr-1 shrink-0">
          {stats.added > 0 && <span style={{ color: '#4ade80' }}>+{stats.added}</span>}
          {stats.deleted > 0 && <span style={{ color: '#f87171' }}>-{stats.deleted}</span>}
          {stats.added === 0 && stats.deleted === 0 && (
            <span style={{ color: 'var(--color-mac-muted)' }}>{stats.fileCount}~</span>
          )}
        </span>
      )}
      <OverflowMenu items={menuItems} />
    </div>
  );
}
