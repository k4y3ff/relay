import { useEffect, useRef } from 'react';
import { useRepo } from '../../context/RepoContext';
import ShellEmbed, { ShellEmbedHandle } from '../terminal/ShellEmbed';
import DiffViewer from '../chat/DiffViewer';

export default function ChatPane() {
  const { activeWorktreePath, activeDiffFile } = useRepo();

  // One tabId per worktree path — created on first visit, kept stable
  const worktreeTabsRef = useRef(new Map<string, string>());
  // Imperative handles for refitting when pane becomes visible
  const shellRefsMap = useRef(new Map<string, ShellEmbedHandle>());

  // Ensure a tabId exists for every worktree we encounter
  if (activeWorktreePath && !worktreeTabsRef.current.has(activeWorktreePath)) {
    worktreeTabsRef.current.set(activeWorktreePath, crypto.randomUUID());
  }

  // Refit the active claude terminal when the diff viewer closes
  useEffect(() => {
    if (!activeDiffFile && activeWorktreePath) {
      const tabId = worktreeTabsRef.current.get(activeWorktreePath);
      if (tabId) shellRefsMap.current.get(tabId)?.refit();
    }
  }, [activeDiffFile, activeWorktreePath]);

  if (!activeWorktreePath) {
    return (
      <div className="chat-pane">
        <div className="pane-placeholder">Select a worktree to open Claude</div>
      </div>
    );
  }

  return (
    <div className="chat-pane">
      {/* Render all known worktree terminals; hide inactive ones to preserve PTY state */}
      {Array.from(worktreeTabsRef.current.entries()).map(([wtp, tabId]) => (
        <div
          key={tabId}
          style={{
            display: wtp === activeWorktreePath && !activeDiffFile ? 'flex' : 'none',
            flex: 1,
            minHeight: 0,
          }}
        >
          <ShellEmbed
            ref={(handle) => {
              if (handle) shellRefsMap.current.set(tabId, handle);
              else shellRefsMap.current.delete(tabId);
            }}
            tabId={tabId}
            cwd={wtp}
            active={wtp === activeWorktreePath && !activeDiffFile}
            command="claude"
          />
        </div>
      ))}
      {activeDiffFile && (
        <DiffViewer
          worktreePath={activeWorktreePath}
          filePath={activeDiffFile.path}
          status={activeDiffFile.status}
          added={activeDiffFile.added}
          deleted={activeDiffFile.deleted}
        />
      )}
    </div>
  );
}
