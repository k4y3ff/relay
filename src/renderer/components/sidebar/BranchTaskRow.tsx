import { useEffect, useRef, useState } from 'react';
import type { BranchTask, ChangedFile } from '../../types/repo';
import { useRepo } from '../../context/RepoContext';
import OverflowMenu from './OverflowMenu';
import StatusDot from './StatusDot';

interface BranchTaskRowProps {
  groupId: string;
  task: BranchTask;
}

export default function BranchTaskRow({ groupId, task }: BranchTaskRowProps) {
  const { activeWorktreePath, selectWorktree, removeTask, updateTaskStatus } = useRepo();
  const isActive = activeWorktreePath === task.worktree.path;
  const [stats, setStats] = useState<{ added: number; deleted: number; fileCount: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const files = (await window.relay.invoke('git:changed-files', {
          worktreePath: task.worktree.path,
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
  }, [task.worktree.path]);

  const menuItems = [
    {
      label: 'Open in Finder',
      action: () => window.relay.invoke('shell:open-path', { path: task.worktree.path }),
    },
    {
      label: 'Copy path',
      action: () => navigator.clipboard.writeText(task.worktree.path),
    },
    {
      label: 'Remove worktree',
      danger: true,
      action: () => removeTask(groupId, task.id),
    },
  ];

  return (
    <div
      title={task.worktree.path}
      onClick={() => selectWorktree(task.worktree.path)}
      style={{ height: 30, minHeight: 30 }}
      className={`group flex items-center justify-between pl-6 pr-3 cursor-pointer text-[14px] select-none ${
        isActive
          ? 'worktree-row-active text-[var(--color-mac-text)]'
          : 'text-[var(--color-mac-muted)] hover:bg-[var(--color-mac-surface2)] hover:text-[var(--color-mac-text)]'
      }`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <StatusDot status={task.status} onChange={(s) => updateTaskStatus(groupId, task.id, s)} />
        <span className="truncate">{task.repoName} / {task.worktree.branch}</span>
      </div>
      <div className="relative shrink-0 w-5 flex items-center justify-end">
        {stats && (
          <span className="absolute right-0 flex gap-1 text-[12px] font-mono whitespace-nowrap group-hover:hidden">
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
