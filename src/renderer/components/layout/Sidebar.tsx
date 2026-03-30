import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Filter, Plus } from 'lucide-react';
import { useRepo } from '../../context/RepoContext';
import TaskGroupSection from '../sidebar/TaskGroupSection';
import TaskRow from '../sidebar/TaskRow';
import SidebarFilterMenu from '../sidebar/SidebarFilterMenu';
import type { GroupBy } from '../sidebar/SidebarFilterMenu';
import type { TaskGroup, TaskStatus, Task } from '../../types/repo';

export default function Sidebar({ style }: { style?: React.CSSProperties }) {
  const { taskGroups, loading, createTaskGroup, collapsedGroups, toggleGroupCollapsed, selectWorktree, selectManualTask } = useRepo();
  const [isCreating, setIsCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sidebar keyboard navigation state
  const [navActive, setNavActive] = useState(false);
  const [navIndex, setNavIndex] = useState(0);

  // Sidebar search state (activated via Cmd+Shift+G then Cmd+F)
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Compute display groups based on groupBy, filterStatuses, and searchQuery
  const filteredTaskGroups = useMemo<TaskGroup[]>(() => {
    const query = searchQuery.trim().toLowerCase();
    return taskGroups.map((g) => ({
      ...g,
      tasks: g.tasks.filter((t) => {
        if (filterStatuses.size > 0 && !filterStatuses.has(t.status)) return false;
        if (query) {
          return t.title.toLowerCase().includes(query);
        }
        return true;
      }),
    }));
  }, [taskGroups, filterStatuses, searchQuery]);

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

  // Flat ordered list of navigable items (groups + visible tasks)
  const navItems = useMemo(() => {
    if (groupBy !== 'task-group') return [];
    const items: Array<{ kind: 'group'; groupId: string } | { kind: 'task'; groupId: string; task: Task }> = [];
    const isSearching = searchActive && searchQuery.trim().length > 0;
    for (const group of filteredTaskGroups) {
      if (!isSearching) items.push({ kind: 'group', groupId: group.id });
      if (isSearching || !collapsedGroups.has(group.id)) {
        for (const task of group.tasks) {
          items.push({ kind: 'task', groupId: group.id, task });
        }
      }
    }
    return items;
  }, [filteredTaskGroups, collapsedGroups, groupBy, searchActive, searchQuery]);

  // Clamp navIndex when the item list shrinks (e.g. group collapses)
  useEffect(() => {
    if (navItems.length > 0) setNavIndex((i) => Math.min(i, navItems.length - 1));
  }, [navItems.length]);

  // Cmd+Shift+G: activate sidebar navigation
  useEffect(() => {
    return window.relay.on('focus:sidebar', () => {
      setNavActive(true);
      setNavIndex(0);
      setSearchActive(false);
      setSearchQuery('');
      setTimeout(() => scrollRef.current?.focus(), 0);
    });
  }, []);

  useEffect(() => {
    const handler = () => {
      setNavActive(false);
      setSearchActive(false);
      setSearchQuery('');
    };
    window.addEventListener('nav:deactivate', handler);
    return () => window.removeEventListener('nav:deactivate', handler);
  }, []);

  // Arrow / Enter / Escape / Cmd+F handling while nav is active
  useEffect(() => {
    if (!navActive) return;
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'f') {
        e.preventDefault();
        setSearchActive(true);
        setNavIndex(0);
        setTimeout(() => searchInputRef.current?.focus(), 0);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setNavIndex((i) => Math.min(i + 1, navItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setNavIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        const item = navItems[navIndex];
        if (!item) return;
        if (item.kind === 'group') {
          toggleGroupCollapsed(item.groupId);
        } else {
          if (item.task.type === 'branch') {
            selectWorktree(item.task.worktree.path);
            setTimeout(() => window.dispatchEvent(new CustomEvent('chat:focus')), 0);
          } else {
            selectManualTask(item.task.id);
            setTimeout(() => window.dispatchEvent(new CustomEvent('notes:focus')), 0);
          }
          setNavActive(false);
          setSearchActive(false);
          setSearchQuery('');
        }
      } else if (e.key === 'Escape') {
        if (searchActive && searchQuery.length > 0) {
          setSearchQuery('');
          setNavIndex(0);
        } else if (searchActive) {
          setSearchActive(false);
          setTimeout(() => scrollRef.current?.focus(), 0);
        } else {
          setNavActive(false);
        }
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [navActive, navIndex, navItems, searchActive, searchQuery, toggleGroupCollapsed, selectWorktree, selectManualTask]);

  // Scroll the highlighted item into view
  useEffect(() => {
    if (navActive) {
      document.querySelector('[data-nav-highlighted]')?.scrollIntoView({ block: 'nearest' });
    }
  }, [navIndex, navActive]);

  const currentNavItem = navActive ? navItems[navIndex] : null;
  const highlightedGroupId = currentNavItem?.kind === 'group' ? currentNavItem.groupId : null;
  const highlightedTaskId = currentNavItem?.kind === 'task' ? currentNavItem.task.id : null;

  return (
    <div className="sidebar flex flex-col h-full relative" style={style}>
      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center px-3 border-b border-[var(--color-mac-border)] relative"
        style={{ height: 34 }}
      >
        <span className="flex-1 text-[12px] font-semibold uppercase tracking-widest text-[var(--color-mac-muted)]">
          Task Groups
        </span>
        <button
          onClick={() => setFilterMenuOpen((v) => !v)}
          className="flex items-center justify-center w-6 h-6 rounded transition-colors"
          style={{
            color: isFiltered ? 'var(--color-mac-accent)' : 'var(--color-mac-muted)',
          }}
          aria-label="Filter and group options"
        >
          <Filter size={14} />
        </button>
        <button
          onClick={() => setIsCreating(true)}
          disabled={isCreating}
          className="flex items-center justify-center w-6 h-6 rounded transition-colors text-[var(--color-mac-muted)] hover:text-[var(--color-mac-text)] disabled:opacity-50"
          aria-label="Add task group"
        >
          <Plus size={15} />
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

      {/* Search bar (shown after Cmd+Shift+G → Cmd+F) */}
      {searchActive && (
        <div className="flex-shrink-0 px-2 py-1.5 border-b border-[var(--color-mac-border)]">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setNavIndex(0); }}
            placeholder="Search tasks…"
            className="w-full px-2 py-0.5 text-[13px] rounded bg-[var(--color-mac-bg)] border border-[var(--color-mac-accent)] text-[var(--color-mac-text)] outline-none"
            style={{ userSelect: 'text' }}
          />
        </div>
      )}

      {/* Task group list */}
      <div ref={scrollRef} tabIndex={-1} className="flex-1 overflow-y-auto overflow-x-hidden outline-none">
        {loading && (
          <p className="text-[14px] text-[var(--color-mac-muted)] px-4 py-3">Loading…</p>
        )}

        {groupBy === 'task-group' && (
          <>
            {!loading && filteredTaskGroups.length === 0 && !isCreating && (
              <p className="text-[14px] text-[var(--color-mac-muted)] text-center px-4 py-3">
                No task groups. Create one below.
              </p>
            )}
            {filteredTaskGroups.map((group) => (
              <TaskGroupSection
                key={group.id}
                group={group}
                highlightedGroupId={highlightedGroupId}
                highlightedTaskId={highlightedTaskId}
              />
            ))}
          </>
        )}

        {groupBy !== 'task-group' && (
          <>
            {!loading && syntheticGroups.length === 0 && (
              <p className="text-[14px] text-[var(--color-mac-muted)] text-center px-4 py-3">
                No tasks match.
              </p>
            )}
            {syntheticGroups.map(({ label, entries }) => (
              <div key={label} className="mt-3">
                <div
                  className="flex items-center gap-1.5 px-3"
                  style={{ height: 28 }}
                >
                  <span className="text-[12px] font-semibold uppercase tracking-widest text-[var(--color-mac-muted)]">
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
            <span className="text-[var(--color-mac-muted)] text-[11px] flex-shrink-0">▾</span>
            <input
              ref={inputRef}
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={commitCreate}
              placeholder="Group name"
              className="flex-1 px-1 py-0 text-[14px] font-medium rounded bg-[var(--color-mac-bg)] border border-[var(--color-mac-accent)] text-[var(--color-mac-text)] outline-none"
              style={{ userSelect: 'text' }}
            />
          </div>
        )}
      </div>

    </div>
  );
}
