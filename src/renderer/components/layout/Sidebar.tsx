import { useState, useRef, useEffect } from 'react';
import { useRepo } from '../../context/RepoContext';
import TaskGroupSection from '../sidebar/TaskGroupSection';

export default function Sidebar() {
  const { taskGroups, loading, createTaskGroup } = useRepo();
  const [isCreating, setIsCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="sidebar flex flex-col h-full">
      {/* Task group list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {loading && (
          <p className="text-[13px] text-[var(--color-mac-muted)] px-4 py-3">Loading…</p>
        )}
        {!loading && taskGroups.length === 0 && !isCreating && (
          <p className="text-[13px] text-[var(--color-mac-muted)] text-center px-4 py-3">
            No task groups. Create one below.
          </p>
        )}
        {taskGroups.map((group) => (
          <TaskGroupSection key={group.id} group={group} />
        ))}

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

      {/* Add task group button */}
      <div className="flex-shrink-0 border-t border-[var(--color-mac-border)] p-3">
        <button
          onClick={() => setIsCreating(true)}
          disabled={isCreating}
          className="w-full text-center text-[13px] text-[var(--color-mac-muted)] hover:text-[var(--color-mac-text)] px-2 py-1.5 rounded hover:bg-[var(--color-mac-surface2)] transition-colors disabled:opacity-50"
        >
          + Task group
        </button>
      </div>
    </div>
  );
}
