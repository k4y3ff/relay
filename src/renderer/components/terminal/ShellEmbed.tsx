import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { spawnSparklesAtXTermCursor } from '../../lib/sparkles';
// xterm CSS is already imported by TerminalEmbed; no need to re-import

interface Props {
  tabId: string;
  cwd: string;
  active: boolean;
}

export interface ShellEmbedHandle {
  clear(): void;
  refit(): void;
}

const ShellEmbed = forwardRef<ShellEmbedHandle, Props>(({ tabId, cwd, active }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useImperativeHandle(ref, () => ({
    clear: () => termRef.current?.clear(),
    refit: () => {
      const container = containerRef.current;
      if (!container?.offsetWidth || !container?.offsetHeight) return;
      fitAddonRef.current?.fit();
      const term = termRef.current;
      if (term) {
        window.relay.invoke('shell:resize', { tabId, cols: term.cols, rows: term.rows });
      }
    },
  }));

  // Mount xterm once per tabId
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({ allowProposedApi: true, copyOnSelect: true, fontSize: 13 });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    window.relay.invoke('shell:create', { tabId, cwd, cols: term.cols, rows: term.rows });

    const onData = (payload: unknown) => {
      const { tabId: id, data } = payload as { tabId: string; data: string };
      if (id === tabId) term.write(data);
    };
    const offData = window.relay.on('shell:data', onData);

    const onInput = term.onData((data) => {
      window.relay.invoke('shell:write', { tabId, data });
    });

    const screenEl = container.querySelector('.xterm-screen') as HTMLElement | null;
    const onKey = term.onKey(() => spawnSparklesAtXTermCursor(term, container, screenEl));

    const observer = new ResizeObserver(() => {
      const c = containerRef.current;
      if (!c?.offsetWidth || !c?.offsetHeight) return;
      fitAddon.fit();
      window.relay.invoke('shell:resize', { tabId, cols: term.cols, rows: term.rows });
    });
    observer.observe(container);

    return () => {
      offData();
      onInput.dispose();
      onKey.dispose();
      observer.disconnect();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [tabId]); // cwd is stable per tab instance; eslint-disable-line react-hooks/exhaustive-deps

  // Refit when becoming visible after being hidden
  useEffect(() => {
    if (active) {
      const container = containerRef.current;
      if (!container?.offsetWidth || !container?.offsetHeight) return;
      fitAddonRef.current?.fit();
      const term = termRef.current;
      if (term) {
        window.relay.invoke('shell:resize', { tabId, cols: term.cols, rows: term.rows });
      }
    }
  }, [active, tabId]);

  return (
    <div
      ref={containerRef}
      style={{ display: active ? 'flex' : 'none', width: '100%', height: '100%' }}
    />
  );
});

ShellEmbed.displayName = 'ShellEmbed';
export default ShellEmbed;
