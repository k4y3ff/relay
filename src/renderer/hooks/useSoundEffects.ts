import { useEffect, useRef } from 'react';

function playChime() {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
  osc.start();
  osc.stop(ctx.currentTime + 0.6);
  osc.onended = () => ctx.close();
}

export function useSoundEffects(activeWorktreePath: string | null, activePaneTab: string) {
  const activeWorktreePathRef = useRef(activeWorktreePath);
  const activePaneTabRef = useRef(activePaneTab);

  useEffect(() => {
    activeWorktreePathRef.current = activeWorktreePath;
  }, [activeWorktreePath]);

  useEffect(() => {
    activePaneTabRef.current = activePaneTab;
  }, [activePaneTab]);

  useEffect(() => {
    return window.relay.on('response:complete', async ({ worktreePath }: { worktreePath: string }) => {
      const enabled = await window.relay.invoke('settings:get-sound-effects-enabled');
      if (!enabled) return;

      const tabVisible =
        document.hasFocus() &&
        activeWorktreePathRef.current === worktreePath &&
        activePaneTabRef.current === 'chat';

      if (!tabVisible) {
        playChime();
      }
    });
  }, []);
}
