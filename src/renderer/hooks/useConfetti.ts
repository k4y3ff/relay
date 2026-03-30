import { useEffect, useRef } from 'react';
import { spawnConfetti } from '../lib/sparkles';

export function useConfetti(activeWorktreePath: string | null, activePaneTab: string): void {
  const activeWorktreePathRef = useRef(activeWorktreePath);
  const activePaneTabRef = useRef(activePaneTab);
  const confettiEnabledRef = useRef(false);

  useEffect(() => {
    activeWorktreePathRef.current = activeWorktreePath;
  }, [activeWorktreePath]);

  useEffect(() => {
    activePaneTabRef.current = activePaneTab;
  }, [activePaneTab]);

  useEffect(() => {
    window.relay.invoke('settings:get-confetti-enabled').then((val) => {
      confettiEnabledRef.current = val as boolean;
    });

    const handleSettingsChange = (e: Event) => {
      confettiEnabledRef.current = (e as CustomEvent<boolean>).detail;
    };
    window.addEventListener('settings:confetti-changed', handleSettingsChange);

    const cleanup = window.relay.on('response:complete', ({ worktreePath }: { worktreePath: string }) => {
      if (!confettiEnabledRef.current) return;
      const isActiveTab =
        activeWorktreePathRef.current === worktreePath &&
        activePaneTabRef.current === 'chat';
      if (isActiveTab) spawnConfetti();
    });

    return () => {
      window.removeEventListener('settings:confetti-changed', handleSettingsChange);
      cleanup();
    };
  }, []);
}
