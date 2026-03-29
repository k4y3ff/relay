import { useState, useRef } from 'react';
import type { TaskGroup } from '../../types/repo';
import { useRepo } from '../../context/RepoContext';
import TaskGroupHeader from './TaskGroupHeader';
import TaskRow from './TaskRow';
import AddBranchModal from './AddBranchModal';
import AddManualTaskInput from './AddManualTaskInput';

interface TaskGroupSectionProps {
  group: TaskGroup;
}

export default function TaskGroupSection({ group }: TaskGroupSectionProps) {
  const { collapsedGroups, moveTask } = useRepo();
  const isCollapsed = collapsedGroups.has(group.id);
  const [addingBranch, setAddingBranch] = useState(false);
  const [addingManual, setAddingManual] = useState(false);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relY = e.clientY - rect.top;
    const idx = Math.min(group.tasks.length, Math.max(0, Math.round(relY / 28)));
    setDropIndex(idx);
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setDropIndex(null);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    try {
      const { taskId, groupId: fromGroupId } = JSON.parse(
        e.dataTransfer.getData('application/x-relay-task')
      ) as { taskId: string; groupId: string };

      let insertIndex = dropIndex ?? group.tasks.length;
      // When reordering within the same group, account for the removal shifting indices
      if (fromGroupId === group.id) {
        const fromIndex = group.tasks.findIndex((t) => t.id === taskId);
        if (fromIndex !== -1 && fromIndex < insertIndex) insertIndex -= 1;
      }
      moveTask(fromGroupId, taskId, group.id, Math.max(0, insertIndex));
    } catch {
      // ignore malformed drag data
    }
    setDropIndex(null);
  }

  return (
    <div>
      <TaskGroupHeader
        group={group}
        onAddBranch={() => setAddingBranch(true)}
        onAddManualTask={() => setAddingManual(true)}
      />
      <div
        ref={containerRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          position: 'relative',
          overflow: 'hidden',
          maxHeight: isCollapsed ? 0 : group.tasks.length * 28 + (addingManual ? 32 : 0) + 4,
          transition: 'max-height 150ms ease-out',
        }}
      >
        {/* Drop indicator line */}
        {dropIndex !== null && (
          <div
            style={{
              position: 'absolute',
              left: 16,
              right: 8,
              top: dropIndex * 28,
              height: 2,
              background: 'var(--color-mac-accent)',
              borderRadius: 1,
              pointerEvents: 'none',
              zIndex: 10,
            }}
          />
        )}
        {group.tasks.map((task) => (
          <TaskRow key={task.id} groupId={group.id} task={task} />
        ))}
        {addingManual && (
          <AddManualTaskInput groupId={group.id} onClose={() => setAddingManual(false)} />
        )}
      </div>
      {addingBranch && (
        <AddBranchModal groupId={group.id} onClose={() => setAddingBranch(false)} />
      )}
    </div>
  );
}
