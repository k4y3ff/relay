import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Filter, Plus } from 'lucide-react';
import { useRepo } from '../../context/RepoContext';
import TaskGroupSection from '../sidebar/TaskGroupSection';
import TaskRow from '../sidebar/TaskRow';
import SidebarFilterMenu from '../sidebar/SidebarFilterMenu';
import type { GroupBy } from '../sidebar/SidebarFilterMenu';
import type { TaskGroup, TaskStatus, Task } from '../../types/repo';

export default function Sidebar({ style }: { style?: React.CSSProperties }) {
  const { taskGroups, loading, createTaskGroup } = useRepo();
  const [isCreating, setIsCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const [groupBy, setGroupBy] = useState<GroupBy>('task-group');
  const [filterStatuses, setFilterStatuses] = useState<Set<TaskStatus>>(new Set());
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);

  const isFiltered = groupBy !== 'task-group' || filterStatuses.size > 0;

  useEffect(() => {
    if (isCreating) {
      setDraftName('');
      inputRef.current?.focus();
    }
  }, [isCreating]);

  async function commitCreate() {
    const trimmed = draftName.trim();
    if (trimmed) {
      await createTaskGroup(trimmed);
    }
    setIsCreating(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitCreate();
    if (e.key === 'Escape') setIsCreating(false);
  }

  // Compute display groups based on groupBy and filterStatuses
  const filteredTaskGroups = useMemo<TaskGroup[]>(() => {
    if (filterStatuses.size === 0) return taskGroups;
    return taskGroups.map((g) => ({
      ...g,
      tasks: g.tasks.filter((t) => filterStatuses.has(t.status)),
    }));
  }, [taskGroups, filterStatuses]);

  // For repo/status groupings: flat list of all tasks (filtered)
  const allFilteredTasks = useMemo<{ task: Task; groupId: string }[]>(() => {
    return filteredTaskGroups.flatMap((g) => g.tasks.map((t) => ({ task: t, groupId: g.id })));
  }, [filteredTaskGroups]);

  // Synthetic groups for repo/status views
  const syntheticGroups = useMemo<{ label: string; entries: { task: Task; groupId: string }[] }[]>(() => {
    if (groupBy === 'task-group') return [];

    if (groupBy === 'repo') {
      const map = new Map<string, { task: Task; groupId: string }[]>();
      for (const entry of allFilteredTasks) {
        const key = entry.task.type === 'branch' ? entry.task.repoName : 'Manual Tasks';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(entry);
      }
      return Array.from(map.entries()).map(([label, entries]) => ({ label, entries }));
    }

    // groupBy === 'status'
    const STATUS_ORDER: TaskStatus[] = ['todo', 'in-progress', 'blocked', 'done'];
    const STATUS_LABELS: Record<TaskStatus, string> = {
      'todo': 'To Do',
      'in-progress': 'In Progress',
      'blocked': 'Blocked',
      'done': 'Done',
    };
    const map = new Map<TaskStatus, { task: Task; groupId: string }[]>();
    for (const entry of allFilteredTasks) {
      const key = entry.task.status;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    return STATUS_ORDER
      .filter((s) => map.has(s))
      .map((s) => ({ label: STATUS_LABELS[s], entries: map.get(s)! }));
  }, [groupBy, allFilteredTasks]);

  return (
    <div className="sidebar flex flex-col h-full relative" style={style}>
      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center px-3 border-b border-[var(--color-mac-border)] relative"
        style={{ height: 32 }}
      >
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-mac-muted)]">
          Task Groups
        </span>
        <button
          onClick={() => setFilterMenuOpen((v) => !v)}
          className="flex items-center justify-center w-5 h-5 rounded transition-colors"
          style={{
            color: isFiltered ? 'var(--color-mac-accent)' : 'var(--color-mac-muted)',
          }}
          aria-label="Filter and group options"
        >
          <Filter size={13} />
        </button>
        <button
          onClick={() => setIsCreating(true)}
          disabled={isCreating}
          className="flex items-center justify-center w-5 h-5 rounded transition-colors text-[var(--color-mac-muted)] hover:text-[var(--color-mac-text)] disabled:opacity-50"
          aria-label="Add task group"
        >
          <Plus size={14} />
        </button>

        {filterMenuOpen && (
          <SidebarFilterMenu
            groupBy={groupBy}
            filterStatuses={filterStatuses}
            onGroupByChange={setGroupBy}
            onFilterStatusesChange={setFilterStatuses}
            onClose={() => setFilterMenuOpen(false)}
          />
        )}
      </div>

      {/* Task group list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {loading && (
          <p className="text-[13px] text-[var(--color-mac-muted)] px-4 py-3">Loading…</p>
        )}

        {groupBy === 'task-group' && (
          <>
            {!loading && filteredTaskGroups.length === 0 && !isCreating && (
              <p className="text-[13px] text-[var(--color-mac-muted)] text-center px-4 py-3">
                No task groups. Create one below.
              </p>
            )}
            {filteredTaskGroups.map((group) => (
              <TaskGroupSection key={group.id} group={group} />
            ))}
          </>
        )}

        {groupBy !== 'task-group' && (
          <>
            {!loading && syntheticGroups.length === 0 && (
              <p className="text-[13px] text-[var(--color-mac-muted)] text-center px-4 py-3">
                No tasks match.
              </p>
            )}
            {syntheticGroups.map(({ label, entries }) => (
              <div key={label}>
                <div
                  className="flex items-center gap-1.5 px-3"
                  style={{ height: 26 }}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-mac-muted)]">
                    {label}
                  </span>
                </div>
                {entries.map(({ task, groupId }) => (
                  <TaskRow key={task.id} groupId={groupId} task={task} />
                ))}
              </div>
            ))}
          </>
        )}

        {/* Inline new group input */}
        {isCreating && (
          <div className="flex items-center gap-1.5 px-3 py-2">
            <span className="text-[var(--color-mac-muted)] text-[10px] flex-shrink-0">▾</span>
            <input
              ref={inputRef}
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={commitCreate}
              placeholder="Group name"
              className="flex-1 px-1 py-0 text-[13px] font-medium rounded bg-[var(--color-mac-bg)] border border-[var(--color-mac-accent)] text-[var(--color-mac-text)] outline-none"
              style={{ userSelect: 'text' }}
            />
          </div>
        )}
      </div>

    </div>
  );
}
