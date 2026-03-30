import { useState, useRef } from 'react';
import type { TaskGroup } from '../../types/repo';
import { useRepo } from '../../context/RepoContext';
import TaskGroupHeader from './TaskGroupHeader';
import TaskRow from './TaskRow';
import AddBranchModal from './AddBranchModal';
import AddManualTaskInput from './AddManualTaskInput';

interface TaskGroupSectionProps {
  group: TaskGroup;
  highlightedGroupId?: string | null;
  highlightedTaskId?: string | null;
}

export default function TaskGroupSection({ group, highlightedGroupId, highlightedTaskId }: TaskGroupSectionProps) {
  const { collapsedGroups, moveTask } = useRepo();
  const isCollapsed = collapsedGroups.has(group.id);
  const [addingBranch, setAddingBranch] = useState(false);
  const [addingManual, setAddingManual] = useState(false);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleTaskDragEnter(e: React.DragEvent, i: number) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setDropIndex(e.clientY < rect.top + rect.height / 2 ? i : i + 1);
  }

  // Fallback: when dragging over the container but not over any task row
  // (e.g. an empty group, or below the last task)
  function handleContainerDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (group.tasks.length === 0) setDropIndex(0);
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
    <div className="mt-3">
      <TaskGroupHeader
        group={group}
        onAddBranch={() => setAddingBranch(true)}
        onAddManualTask={() => setAddingManual(true)}
        highlighted={highlightedGroupId === group.id}
      />
      <div
        ref={containerRef}
        onDragOver={handleContainerDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          position: 'relative',
          overflow: 'hidden',
          maxHeight: isCollapsed ? 0 : group.tasks.length * 30 + (addingManual ? 32 : 0) + 4,
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
              top: dropIndex * 30,
              height: 2,
              background: 'var(--color-mac-accent)',
              borderRadius: 1,
              pointerEvents: 'none',
              zIndex: 10,
            }}
          />
        )}
        {group.tasks.map((task, i) => (
          <div key={task.id} onDragEnter={(e) => handleTaskDragEnter(e, i)}>
            <TaskRow groupId={group.id} task={task} highlighted={highlightedTaskId === task.id} />
          </div>
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
