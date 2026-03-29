import type { TaskStatus } from '../../types/repo';

const STATUS_COLORS: Record<TaskStatus, string> = {
  'todo': '#6b7280',
  'in-progress': '#3b82f6',
  'blocked': '#f97316',
  'done': '#22c55e',
};

const STATUS_CYCLE: TaskStatus[] = ['todo', 'in-progress', 'blocked', 'done'];

interface StatusDotProps {
  status: TaskStatus;
  onChange: (next: TaskStatus) => void;
}

export default function StatusDot({ status, onChange }: StatusDotProps) {
  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    const idx = STATUS_CYCLE.indexOf(status);
    onChange(STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]);
  }

  return (
    <button
      onClick={handleClick}
      title={status}
      className="flex-shrink-0 rounded-full focus:outline-none"
      style={{
        width: 8,
        height: 8,
        background: STATUS_COLORS[status],
        cursor: 'pointer',
        border: 'none',
        padding: 0,
      }}
    />
  );
}
