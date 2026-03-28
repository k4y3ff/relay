import { useState } from 'react';
import type { TaskGroup } from '../../types/repo';
import { useRepo } from '../../context/RepoContext';
import TaskGroupHeader from './TaskGroupHeader';
import WorktreeRow from './WorktreeRow';
import AddBranchModal from './AddBranchModal';

interface TaskGroupSectionProps {
  group: TaskGroup;
}

export default function TaskGroupSection({ group }: TaskGroupSectionProps) {
  const { collapsedGroups } = useRepo();
  const isCollapsed = collapsedGroups.has(group.id);
  const [addingBranch, setAddingBranch] = useState(false);

  return (
    <div>
      <TaskGroupHeader group={group} onAddBranch={() => setAddingBranch(true)} />
      <div
        style={{
          overflow: 'hidden',
          maxHeight: isCollapsed ? 0 : group.branches.length * 28 + 4,
          transition: 'max-height 150ms ease-out',
        }}
      >
        {group.branches.map((branch) => (
          <WorktreeRow
            key={branch.worktree.path}
            groupId={group.id}
            repoName={branch.repoName}
            repoRootPath={branch.repoRootPath}
            worktree={branch.worktree}
          />
        ))}
      </div>
      {addingBranch && (
        <AddBranchModal groupId={group.id} onClose={() => setAddingBranch(false)} />
      )}
    </div>
  );
}
