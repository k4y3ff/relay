import AppShell from './components/layout/AppShell';
import { RepoProvider } from './context/RepoContext';
import { ChatProvider } from './context/ChatContext';

export default function App() {
  return (
    <RepoProvider>
      <ChatProvider>
        <AppShell />
      </ChatProvider>
    </RepoProvider>
  );
}
