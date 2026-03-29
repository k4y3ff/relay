import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { spawnSparklesAtXTermCursor } from '../../lib/sparkles';
import { useTheme } from '../../context/ThemeContext';

interface Props {
  terminalId: string;
  worktreePath: string;
  active: boolean;
}

export default function TerminalEmbed({ terminalId, worktreePath, active }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      allowProposedApi: true,
      fontSize: 13,
      theme: theme.chatTerminal ?? theme.terminal,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    window.relay.invoke('terminal:create', {
      terminalId,
      worktreePath,
      cols: term.cols,
      rows: term.rows,
    });

    const onData = (payload: unknown) => {
      const { terminalId: tid, data } = payload as { terminalId: string; data: string };
      if (tid === terminalId) term.write(data);
    };
    const offData = window.relay.on('terminal:data', onData);

    const onTermData = term.onData((data) => {
      window.relay.invoke('terminal:write', { terminalId, data });
    });

    const screenEl = container.querySelector('.xterm-screen') as HTMLElement | null;
    const onKey = term.onKey(() => spawnSparklesAtXTermCursor(term, container, screenEl));

    const refit = () => {
      if (!container.offsetWidth || !container.offsetHeight) return;
      fitAddon.fit();
      window.relay.invoke('terminal:resize', {
        terminalId,
        cols: term.cols,
        rows: term.rows,
      });
    };
    window.addEventListener('terminal:refit', refit);

    const observer = new ResizeObserver(() => {
      if (!container.offsetWidth || !container.offsetHeight) return;
      fitAddon.fit();
      window.relay.invoke('terminal:resize', {
        terminalId,
        cols: term.cols,
        rows: term.rows,
      });
    });
    observer.observe(container);

    return () => {
      window.removeEventListener('terminal:refit', refit);
      offData();
      onTermData.dispose();
      onKey.dispose();
      observer.disconnect();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [terminalId]);

  // Apply theme updates to the running terminal
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = theme.chatTerminal ?? theme.terminal;
    }
  }, [theme]);

  // Refit when becoming visible after being hidden
  useEffect(() => {
    if (active) {
      const container = containerRef.current;
      if (!container?.offsetWidth || !container?.offsetHeight) return;
      fitAddonRef.current?.fit();
      const term = termRef.current;
      if (term) {
        window.relay.invoke('terminal:resize', {
          terminalId,
          cols: term.cols,
          rows: term.rows,
        });
      }
    }
  }, [active, terminalId]);

  return (
    <div
      ref={containerRef}
      style={{ display: active ? 'flex' : 'none', width: '100%', height: '100%' }}
    />
  );
}
