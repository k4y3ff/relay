import type { Task } from '../../types/repo';
import BranchTaskRow from './BranchTaskRow';
import ManualTaskRow from './ManualTaskRow';

interface TaskRowProps {
  groupId: string;
  task: Task;
  highlighted?: boolean;
}

export default function TaskRow({ groupId, task, highlighted }: TaskRowProps) {
  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-relay-task', JSON.stringify({ taskId: task.id, groupId }));
  }

  return (
    <div draggable onDragStart={handleDragStart} style={{ cursor: 'grab' }}>
      {task.type === 'branch'
        ? <BranchTaskRow groupId={groupId} task={task} highlighted={highlighted} />
        : <ManualTaskRow groupId={groupId} task={task} highlighted={highlighted} />}
    </div>
  );
}
