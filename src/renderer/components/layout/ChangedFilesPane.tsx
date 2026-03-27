import { CSSProperties } from 'react';

interface Props {
  style?: CSSProperties;
}

export default function ChangedFilesPane({ style }: Props) {
  return (
    <div style={style} className="overflow-hidden">
      <div className="pane-placeholder">Changed Files</div>
    </div>
  );
}
