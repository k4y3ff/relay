import type { ToolUseMessage, ToolResultMessage } from '../../types/chat';

const TOOL_LABELS: Record<string, string> = {
  Read: 'Read file',
  Write: 'Write file',
  Edit: 'Edit file',
  MultiEdit: 'Edit file',
  Bash: 'Run command',
  Glob: 'Find files',
  Grep: 'Search files',
  TodoWrite: 'Update task list',
  TodoRead: 'Update task list',
};

interface Props {
  message: ToolUseMessage;
  result?: ToolResultMessage;
}

export default function ToolCallCard({ message, result }: Props) {
  const label = TOOL_LABELS[message.toolName] ?? message.toolName;

  return (
    <div className="tool-call-card">
      <details>
        <summary className="tool-call-header">
          <span className="tool-call-icon">🔧</span>
          <span className="tool-call-label">{label}</span>
          {message.pending && <span className="tool-call-spinner" />}
          {!message.pending && <span className="tool-call-check">✓</span>}
        </summary>
        <div className="tool-call-body">
          <div className="tool-call-section-label">Input</div>
          <pre className="tool-call-code">{JSON.stringify(message.input, null, 2)}</pre>
          {result && (
            <>
              <div className="tool-call-section-label" style={{ marginTop: 8 }}>
                Output
                {result.isError && <span className="tool-call-error-badge">error</span>}
              </div>
              <pre className="tool-call-code">
                {typeof result.content === 'string'
                  ? result.content
                  : JSON.stringify(result.content, null, 2)}
              </pre>
            </>
          )}
        </div>
      </details>
    </div>
  );
}
