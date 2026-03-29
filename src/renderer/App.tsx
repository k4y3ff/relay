import AppShell from './components/layout/AppShell';
import { RepoProvider } from './context/RepoContext';
import { ThemeProvider } from './context/ThemeContext';

export default function App() {
  return (
    <ThemeProvider>
      <RepoProvider>
        <AppShell />
      </RepoProvider>
    </ThemeProvider>
  );
}
