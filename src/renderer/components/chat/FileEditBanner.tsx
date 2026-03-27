import type { FileEditBannerMessage } from '../../types/chat';

interface Props {
  message: FileEditBannerMessage;
}

export default function FileEditBanner({ message }: Props) {
  const count = message.filePaths.length;
  return (
    <div className="file-edit-banner">
      <details>
        <summary className="file-edit-summary">
          ✎ Claude edited {count} file{count === 1 ? '' : 's'}
        </summary>
        <ul className="file-edit-list">
          {message.filePaths.map((p) => (
            <li key={p} className="file-edit-item">{p}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
