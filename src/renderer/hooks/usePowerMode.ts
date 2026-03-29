import { RefObject, useEffect } from 'react';
import { setCanvas, setEnabled, stopLoop } from '../lib/sparkles';

export function usePowerMode(canvasRef: RefObject<HTMLCanvasElement>): void {
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    const resize = () => {
      c.width = window.innerWidth;
      c.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    setCanvas(c);

    window.relay.invoke('settings:get-power-mode-enabled').then((val) => {
      setEnabled(val as boolean);
    });

    const handleChange = (e: Event) => {
      setEnabled((e as CustomEvent<boolean>).detail);
    };
    window.addEventListener('settings:power-mode-changed', handleChange);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('settings:power-mode-changed', handleChange);
      stopLoop();
      setCanvas(null);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
