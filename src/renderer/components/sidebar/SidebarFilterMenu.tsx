import { useEffect, useRef, useState } from 'react';
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
  const [navIndex, setNavIndex] = useState(0);

  const allItems: Array<{ kind: 'groupBy'; value: GroupBy } | { kind: 'status'; value: TaskStatus }> = [
    ...GROUP_BY_OPTIONS.map(o => ({ kind: 'groupBy' as const, value: o.value })),
    ...STATUS_OPTIONS.map(o => ({ kind: 'status' as const, value: o.value })),
  ];

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setNavIndex(i => Math.min(i + 1, allItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setNavIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        const item = allItems[navIndex];
        if (item.kind === 'groupBy') {
          onGroupByChange(item.value);
        } else {
          toggleStatus(item.value);
        }
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [navIndex, allItems, onGroupByChange, onFilterStatusesChange, filterStatuses, onClose]);

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
          {GROUP_BY_OPTIONS.map(({ value, label }, i) => (
            <label
              key={value}
              className="flex items-center gap-2 text-[13px] py-0.5 cursor-pointer select-none rounded px-1"
              style={{
                color: navIndex === i ? 'var(--color-mac-bg)' : 'var(--color-mac-text)',
                background: navIndex === i ? 'var(--color-mac-accent)' : undefined,
              }}
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
          {STATUS_OPTIONS.map(({ value, label }, i) => {
            const itemIndex = GROUP_BY_OPTIONS.length + i;
            return (
              <label
                key={value}
                className="flex items-center gap-2 text-[13px] py-0.5 cursor-pointer select-none rounded px-1"
                style={{
                  color: navIndex === itemIndex ? 'var(--color-mac-bg)' : 'var(--color-mac-text)',
                  background: navIndex === itemIndex ? 'var(--color-mac-accent)' : undefined,
                }}
              >
                <input
                  type="checkbox"
                  checked={filterStatuses.has(value)}
                  onChange={() => toggleStatus(value)}
                  className="accent-[var(--color-mac-accent)]"
                />
                {label}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
