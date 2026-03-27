import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface Props {
  worktreePath: string;
}

export default function TerminalEmbed({ worktreePath }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({ allowProposedApi: true });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    fitAddon.fit();

    window.relay.invoke('terminal:create', {
      worktreePath,
      cols: term.cols,
      rows: term.rows,
    });

    const onData = (payload: unknown) => {
      const { worktreePath: wp, data } = payload as { worktreePath: string; data: string };
      if (wp === worktreePath) term.write(data);
    };
    window.relay.on('terminal:data', onData);

    const onTermData = term.onData((data) => {
      window.relay.invoke('terminal:write', { worktreePath, data });
    });

    const observer = new ResizeObserver(() => {
      fitAddon.fit();
      window.relay.invoke('terminal:resize', {
        worktreePath,
        cols: term.cols,
        rows: term.rows,
      });
    });
    observer.observe(container);

    return () => {
      window.relay.off('terminal:data', onData);
      onTermData.dispose();
      observer.disconnect();
      term.dispose();
    };
  }, [worktreePath]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
