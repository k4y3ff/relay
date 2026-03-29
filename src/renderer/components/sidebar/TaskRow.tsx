import type { Task } from '../../types/repo';
import BranchTaskRow from './BranchTaskRow';
import ManualTaskRow from './ManualTaskRow';

interface TaskRowProps {
  groupId: string;
  task: Task;
}

export default function TaskRow({ groupId, task }: TaskRowProps) {
  if (task.type === 'branch') {
    return <BranchTaskRow groupId={groupId} task={task} />;
  }
  return <ManualTaskRow groupId={groupId} task={task} />;
}
