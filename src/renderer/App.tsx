import AppShell from './components/layout/AppShell';
import { RepoProvider } from './context/RepoContext';

export default function App() {
  return (
    <RepoProvider>
      <AppShell />
    </RepoProvider>
  );
}
