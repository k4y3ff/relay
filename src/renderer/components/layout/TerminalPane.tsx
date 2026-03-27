import { CSSProperties } from 'react';

interface Props {
  style?: CSSProperties;
}

export default function TerminalPane({ style }: Props) {
  return (
    <div style={style} className="overflow-hidden">
      <div className="pane-placeholder">Terminal</div>
    </div>
  );
}
