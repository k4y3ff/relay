import { useState, useRef, useEffect } from 'react';
import type { ManualTask } from '../../types/repo';
import { useRepo } from '../../context/RepoContext';
import OverflowMenu from './OverflowMenu';
import StatusDot from './StatusDot';

interface ManualTaskRowProps {
  groupId: string;
  task: ManualTask;
}

export default function ManualTaskRow({ groupId, task }: ManualTaskRowProps) {
  const { removeTask, updateTaskStatus, renameTask } = useRepo();
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) {
      setDraftTitle(task.title);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming, task.title]);

  function commitRename() {
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== task.title) {
      renameTask(groupId, task.id, trimmed);
    }
    setRenaming(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') setRenaming(false);
  }

  const menuItems = [
    { label: 'Rename', action: () => setRenaming(true) },
    { label: 'Delete', danger: true, action: () => removeTask(groupId, task.id) },
  ];

  return (
    <div
      style={{ height: 30, minHeight: 30 }}
      className="group flex items-center justify-between pl-6 pr-3 text-[14px] select-none text-[var(--color-mac-muted)] hover:bg-[var(--color-mac-surface2)] hover:text-[var(--color-mac-text)]"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <StatusDot status={task.status} onChange={(s) => updateTaskStatus(groupId, task.id, s)} />
        {renaming ? (
          <input
            ref={inputRef}
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitRename}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 px-1 py-0 text-[14px] rounded bg-[var(--color-mac-bg)] border border-[var(--color-mac-accent)] text-[var(--color-mac-text)] outline-none"
            style={{ userSelect: 'text' }}
          />
        ) : (
          <span
            className={`truncate cursor-default ${task.status === 'done' ? 'line-through opacity-50' : ''}`}
            onDoubleClick={() => setRenaming(true)}
          >
            {task.title}
          </span>
        )}
      </div>
      <div className="shrink-0 w-5 flex items-center justify-end">
        <OverflowMenu items={menuItems} />
      </div>
    </div>
  );
}
