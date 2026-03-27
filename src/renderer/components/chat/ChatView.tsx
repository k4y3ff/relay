import { useChatSession } from '../../context/ChatContext';
import MessageList from './MessageList';
import ChatInput from './ChatInput';

interface Props {
  worktreePath: string;
}

export default function ChatView({ worktreePath }: Props) {
  const { session, sendMessage, stopStreaming, newChat } = useChatSession();
  const current = session(worktreePath) ?? { messages: [], streaming: false, worktreePath };

  const userMessageCount = current.messages.filter((m) => m.role === 'user').length;

  return (
    <div className="chat-view">
      <MessageList messages={current.messages} streaming={current.streaming} />
      <ChatInput
        streaming={current.streaming}
        messageCount={userMessageCount}
        onSend={(text) => sendMessage(worktreePath, text)}
        onStop={() => stopStreaming(worktreePath)}
        onNewChat={() => newChat(worktreePath)}
      />
    </div>
  );
}
