import { useEffect, useState } from 'react';
import { useRepo } from '../../context/RepoContext';
import TerminalEmbed from '../chat/TerminalEmbed';
import DiffViewer from '../chat/DiffViewer';
import FileViewer from '../chat/FileViewer';

function basename(filePath: string): string {
  return filePath.split('/').pop() ?? filePath;
}

export default function ChatPane() {
  const { activeWorktreePath, diffTabs, activePaneTab, closeDiffTab, selectPaneTab } = useRepo();
  const [mountedPaths, setMountedPaths] = useState<string[]>([]);

  // Track all visited worktree paths so their terminals stay mounted
  useEffect(() => {
    if (activeWorktreePath) {
      setMountedPaths((prev) =>
        prev.includes(activeWorktreePath) ? prev : [...prev, activeWorktreePath]
      );
    }
  }, [activeWorktreePath]);

  // When switching to the Chat tab, signal the active TerminalEmbed to re-fit.
  useEffect(() => {
    if (activePaneTab === 'chat') {
      window.dispatchEvent(new CustomEvent('terminal:refit'));
    }
  }, [activePaneTab]);

  const activeDiffFile = diffTabs.find((t) => t.path === activePaneTab) ?? null;

  return (
    <div className="chat-pane">
      {!activeWorktreePath && (
        <div className="pane-placeholder">Select a worktree to start chatting</div>
      )}
      {activeWorktreePath && (
        <div className="chat-tab-bar">
          <button
            className={`chat-tab${activePaneTab === 'chat' ? ' chat-tab-active' : ''}`}
            onClick={() => selectPaneTab('chat')}
          >
            Chat
          </button>
          {diffTabs.map((file) => (
            <button
              key={file.path}
              className={`chat-tab${activePaneTab === file.path ? ' chat-tab-active' : ''}`}
              onClick={() => selectPaneTab(file.path)}
              title={file.path}
            >
              {basename(file.path)}
              <span
                className="chat-tab-close"
                onClick={(e) => { e.stopPropagation(); closeDiffTab(file.path); }}
              >
                ×
              </span>
            </button>
          ))}
        </div>
      )}
      {mountedPaths.map((path) => {
        const isActive = activePaneTab === 'chat' && path === activeWorktreePath;
        return (
          <div
            key={path}
            style={{ display: isActive ? 'flex' : 'none', flex: 1, minHeight: 0 }}
          >
            <TerminalEmbed worktreePath={path} active={isActive} />
          </div>
        );
      })}
      {activeDiffFile && activeDiffFile.status === 'R' && activeWorktreePath && (
        <FileViewer worktreePath={activeWorktreePath} filePath={activeDiffFile.path} />
      )}
      {activeDiffFile && activeDiffFile.status !== 'R' && activeWorktreePath && (
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
