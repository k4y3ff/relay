import type { ResultMessage } from '../../types/chat';

interface Props {
  message: ResultMessage;
}

export default function ResultFooter({ message }: Props) {
  const cost =
    message.costUsd > 0 ? `$${message.costUsd.toFixed(4)}` : null;
  const duration =
    message.durationMs > 0 ? `${(message.durationMs / 1000).toFixed(1)}s` : null;
  const turns =
    message.turns > 0 ? `${message.turns} turn${message.turns === 1 ? '' : 's'}` : null;

  const parts = [cost, duration, turns].filter(Boolean);

  return (
    <div className="result-footer">{parts.join(' · ')}</div>
  );
}
