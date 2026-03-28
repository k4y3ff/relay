import { useState, useRef, useEffect } from 'react';
import type { TaskGroup } from '../../types/repo';
import { useRepo } from '../../context/RepoContext';
import OverflowMenu from './OverflowMenu';

interface TaskGroupHeaderProps {
  group: TaskGroup;
  onAddBranch: () => void;
}

export default function TaskGroupHeader({ group, onAddBranch }: TaskGroupHeaderProps) {
  const { collapsedGroups, toggleGroupCollapsed, removeTaskGroup, renameTaskGroup } = useRepo();
  const isCollapsed = collapsedGroups.has(group.id);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) {
      setDraftName(group.name);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming, group.name]);

  function commitRename() {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== group.name) {
      renameTaskGroup(group.id, trimmed);
    }
    setRenaming(false);
  }

  function handleRenameKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') setRenaming(false);
  }

  const menuItems = [
    { label: 'Add branch', action: onAddBranch },
    { label: 'Rename', action: () => setRenaming(true) },
    { label: 'Delete group', danger: true, action: () => removeTaskGroup(group.id) },
  ];

  return (
    <div
      className="group flex items-center gap-1.5 px-3 py-2 cursor-pointer select-none hover:bg-[var(--color-mac-surface2)] text-[var(--color-mac-text)]"
      onClick={() => { if (!renaming) toggleGroupCollapsed(group.id); }}
    >
      {/* Chevron */}
      <span
        className="text-[var(--color-mac-muted)] text-[10px] transition-transform duration-150 flex-shrink-0"
        style={{ display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
      >
        ▾
      </span>

      {/* Name or rename input */}
      {renaming ? (
        <input
          ref={inputRef}
          type="text"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={handleRenameKeyDown}
          onBlur={commitRename}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 px-1 py-0 text-[13px] font-medium rounded bg-[var(--color-mac-bg)] border border-[var(--color-mac-accent)] text-[var(--color-mac-text)] outline-none"
          style={{ userSelect: 'text' }}
        />
      ) : (
        <span className="flex-1 truncate text-[13px] font-medium">{group.name}</span>
      )}

      {/* Overflow menu */}
      <OverflowMenu items={menuItems} />
    </div>
  );
}
