import { useState } from 'react';
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
  const { collapsedGroups } = useRepo();
  const isCollapsed = collapsedGroups.has(group.id);
  const [addingBranch, setAddingBranch] = useState(false);
  const [addingManual, setAddingManual] = useState(false);

  return (
    <div>
      <TaskGroupHeader
        group={group}
        onAddBranch={() => setAddingBranch(true)}
        onAddManualTask={() => setAddingManual(true)}
      />
      <div
        style={{
          overflow: 'hidden',
          maxHeight: isCollapsed ? 0 : group.tasks.length * 28 + (addingManual ? 32 : 0) + 4,
          transition: 'max-height 150ms ease-out',
        }}
      >
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
