import { useEffect, useState } from 'react';

export default function SparkleIndicator() {
  const [powerMode, setPowerMode] = useState(false);

  useEffect(() => {
    window.relay.invoke('settings:get-power-mode-enabled').then((val) => {
      setPowerMode(val as boolean);
    });
    const handleChange = (e: Event) => {
      setPowerMode((e as CustomEvent<boolean>).detail);
    };
    window.addEventListener('settings:power-mode-changed', handleChange);
    return () => window.removeEventListener('settings:power-mode-changed', handleChange);
  }, []);

  return (
    <span
      className={`sparkle-indicator${powerMode ? ' sparkle-indicator--power' : ''}`}
      aria-hidden="true"
    >
      ✦
    </span>
  );
}
