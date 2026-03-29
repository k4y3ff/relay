import { useRef, useEffect, useState } from 'react';
import { useRepo } from '../../context/RepoContext';

interface AddManualTaskInputProps {
  groupId: string;
  onClose: () => void;
}

export default function AddManualTaskInput({ groupId, onClose }: AddManualTaskInputProps) {
  const { addManualTask } = useRepo();
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function commit() {
    const trimmed = title.trim();
    if (trimmed) {
      await addManualTask(groupId, trimmed);
    }
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') onClose();
  }

  return (
    <div
      style={{ height: 28, minHeight: 28 }}
      className="flex items-center pl-6 pr-3 gap-2"
    >
      <span className="flex-shrink-0 rounded-full" style={{ width: 8, height: 8, background: '#6b7280' }} />
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        placeholder="Task name…"
        className="flex-1 px-1 py-0 text-[13px] rounded bg-[var(--color-mac-bg)] border border-[var(--color-mac-accent)] text-[var(--color-mac-text)] outline-none placeholder:text-[var(--color-mac-muted)]"
        style={{ userSelect: 'text' }}
      />
    </div>
  );
}
