import type { UserMessage } from '../../types/chat';

interface Props {
  message: UserMessage;
}

export default function MessageBubble({ message }: Props) {
  return (
    <div className="message-bubble-wrap">
      <div className="message-bubble">{message.text}</div>
    </div>
  );
}
