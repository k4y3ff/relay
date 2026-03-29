import { useEffect, useRef } from 'react';
import type { TaskStatus } from '../../types/repo';

export type GroupBy = 'task-group' | 'repo' | 'status';

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'task-group', label: 'Task group' },
  { value: 'repo', label: 'Repo' },
  { value: 'status', label: 'Task status' },
];

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
];

interface SidebarFilterMenuProps {
  groupBy: GroupBy;
  filterStatuses: Set<TaskStatus>;
  onGroupByChange: (value: GroupBy) => void;
  onFilterStatusesChange: (value: Set<TaskStatus>) => void;
  onClose: () => void;
}

export default function SidebarFilterMenu({
  groupBy,
  filterStatuses,
  onGroupByChange,
  onFilterStatusesChange,
  onClose,
}: SidebarFilterMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  function toggleStatus(status: TaskStatus) {
    const next = new Set(filterStatuses);
    if (next.has(status)) next.delete(status);
    else next.add(status);
    onFilterStatusesChange(next);
  }

  return (
    <div
      ref={ref}
      className="absolute left-0 right-0 z-10 border-b border-x border-[var(--color-mac-border)] bg-[var(--color-mac-surface2)]"
      style={{ top: 34 }}
    >
      {/* Group by */}
      <div className="px-3 pt-2.5 pb-1">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-mac-muted)] mb-1.5">
          Group by
        </p>
        <div className="flex flex-col gap-0.5">
          {GROUP_BY_OPTIONS.map(({ value, label }) => (
            <label
              key={value}
              className="flex items-center gap-2 text-[13px] text-[var(--color-mac-text)] py-0.5 cursor-pointer select-none"
            >
              <input
                type="radio"
                name="groupBy"
                value={value}
                checked={groupBy === value}
                onChange={() => onGroupByChange(value)}
                className="accent-[var(--color-mac-accent)]"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="mx-3 border-t border-[var(--color-mac-border)]" />

      {/* Filter by status */}
      <div className="px-3 pt-2 pb-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-mac-muted)] mb-1.5">
          Filter by status
        </p>
        <div className="flex flex-col gap-0.5">
          {STATUS_OPTIONS.map(({ value, label }) => (
            <label
              key={value}
              className="flex items-center gap-2 text-[13px] text-[var(--color-mac-text)] py-0.5 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={filterStatuses.has(value)}
                onChange={() => toggleStatus(value)}
                className="accent-[var(--color-mac-accent)]"
              />
              {label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
