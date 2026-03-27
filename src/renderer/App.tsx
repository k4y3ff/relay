import AppShell from './components/layout/AppShell';
import { RepoProvider } from './context/RepoContext';
import { ChatProvider } from './context/ChatContext';
import ClaudeValidationGate from './components/chat/ClaudeValidationGate';

export default function App() {
  return (
    <RepoProvider>
      <ChatProvider>
        <ClaudeValidationGate>
          <AppShell />
        </ClaudeValidationGate>
      </ChatProvider>
    </RepoProvider>
  );
}
