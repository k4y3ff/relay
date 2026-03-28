import React, { useCallback, useRef, useState } from 'react';
import ChangedFilesPane from './ChangedFilesPane';
import TerminalPane from './TerminalPane';

const MIN_PANE_HEIGHT = 80;

export default function RightColumn({ style }: { style?: React.CSSProperties }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [topRatio, setTopRatio] = useState(0.5);

  const onDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const startY = e.clientY;
      const totalH = container.getBoundingClientRect().height;
      const startTopH = topRatio * totalH;

      const onMove = (moveEvent: MouseEvent) => {
        const newTopH = Math.max(
          MIN_PANE_HEIGHT,
          Math.min(totalH - MIN_PANE_HEIGHT, startTopH + (moveEvent.clientY - startY))
        );
        setTopRatio(newTopH / totalH);
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [topRatio]
  );

  return (
    <div ref={containerRef} className="right-column" style={style}>
      <ChangedFilesPane style={{ flex: `0 0 ${topRatio * 100}%` }} />
      <div className="divider-h resize-handle" onMouseDown={onDividerMouseDown} />
      <TerminalPane style={{ flex: 1 }} />
    </div>
  );
}
