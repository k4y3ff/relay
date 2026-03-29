import type { TaskStatus } from '../../types/repo';

const STATUS_VARS: Record<TaskStatus, string> = {
  'todo': 'var(--color-status-todo)',
  'in-progress': 'var(--color-status-in-progress)',
  'blocked': 'var(--color-status-blocked)',
  'done': 'var(--color-status-done)',
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
        background: STATUS_VARS[status],
        cursor: 'pointer',
        border: 'none',
        padding: 0,
      }}
    />
  );
}
