import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AssistantMessage } from '../../types/chat';

interface Props {
  message: AssistantMessage;
}

export default function AssistantBlock({ message }: Props) {
  return (
    <div className="assistant-block">
      {message.thinking && (
        <details className="thinking-block">
          <summary className="thinking-summary">Thinking</summary>
          <pre className="thinking-content">{message.thinking}</pre>
        </details>
      )}
      {message.text && (
        <div className="assistant-text">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
