import { useCallback, useEffect, useRef, useState } from 'react';
import { html } from 'diff2html';
import 'diff2html/bundles/css/diff2html.min.css';

const DIFF_COPY_MENU_ID = 'diff-copy-menu';

interface Props {
  worktreePath: string;
  filePath: string;
  status: string;
  added: number;
  deleted: number;
  chatTabs: string[];
  activeChatTabId: string;
  chatTabLabels: Map<string, string>;
}

export default function DiffViewer({ worktreePath, filePath, status, added, deleted, chatTabs, activeChatTabId, chatTabLabels }: Props) {
  const [diffHtml, setDiffHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedText, setSelectedText] = useState<string>('');
  const [toolbarTargetTabId, setToolbarTargetTabId] = useState<string>(activeChatTabId);

  const diffContentRef = useRef<HTMLDivElement>(null);
  const pendingCopyRef = useRef<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    window.relay
      .invoke('git:diff-file', { worktreePath, filePath, untracked: status === '?' })
      .then((rawDiff) => {
        const diffStr = rawDiff as string;
        if (!diffStr.trim()) {
          setError(`No diff output from git for: ${filePath}`);
          return;
        }
        try {
          setDiffHtml(html(diffStr, { drawFileList: false, outputFormat: 'line-by-line' }));
        } catch (e) {
          setError(`Failed to render diff: ${e instanceof Error ? e.message : String(e)}`);
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, [worktreePath, filePath, status]);

  // Sync toolbar target tab when active tab changes
  useEffect(() => {
    setToolbarTargetTabId(activeChatTabId);
  }, [activeChatTabId]);

  // Detect text selection within the diff content — only after mouse is released
  useEffect(() => {
    const onMouseUp = () => {
      const sel = window.getSelection();
      const text = sel?.toString() ?? '';
      if (!diffContentRef.current) return;
      if (text.trim() && sel?.anchorNode && diffContentRef.current.contains(sel.anchorNode)) {
        setSelectedText(text);
      } else if (!text.trim()) {
        setSelectedText('');
      }
    };
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, []);

  // Handle menu:item-clicked for the copy context menu
  useEffect(() => {
    return window.relay.on('menu:item-clicked', (data: unknown) => {
      const { menuId, itemIndex } = data as { menuId: string; itemIndex: number };
      if (menuId !== DIFF_COPY_MENU_ID) return;
      if (itemIndex === 0 && pendingCopyRef.current) {
        void navigator.clipboard.writeText(pendingCopyRef.current);
      }
      pendingCopyRef.current = null;
    });
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const selection = window.getSelection()?.toString() ?? '';
    if (!selection.trim()) return;
    e.preventDefault();
    pendingCopyRef.current = selection;
    void window.relay.invoke('menu:show-context-menu', {
      menuId: DIFF_COPY_MENU_ID,
      items: [{ label: 'Copy' }],
    });
  }, []);

  const handleAddToChat = useCallback(() => {
    if (!selectedText || !toolbarTargetTabId) return;
    const message = `The ${filePath} file says:\n${selectedText}\n\n`;
    void window.relay.invoke('terminal:write', { terminalId: toolbarTargetTabId, data: message });
    setSelectedText('');
  }, [selectedText, toolbarTargetTabId, filePath]);

  return (
    <div className="diff-viewer">
      <div className="diff-viewer-header">
        <span className="diff-filepath">{filePath}</span>
        <span className="diff-counts">
          {added > 0 && <span className="diff-added">+{added}</span>}
          {deleted > 0 && <span className="diff-deleted"> -{deleted}</span>}
        </span>
      </div>

      <div className="diff-viewer-body">
        {selectedText && (
          <div className="diff-selection-toolbar">
            <span className="diff-selection-label">{selectedText.length} chars selected</span>
            {chatTabs.length > 1 && (
              <select
                className="diff-selection-tab-select"
                value={toolbarTargetTabId}
                onChange={(e) => setToolbarTargetTabId(e.target.value)}
              >
                {chatTabs.map((tabId, idx) => (
                  <option key={tabId} value={tabId}>
                    {chatTabLabels.get(tabId) ?? (idx === 0 ? 'Chat' : `Chat ${idx + 1}`)}
                  </option>
                ))}
              </select>
            )}
            <button className="diff-add-to-chat-btn" onClick={handleAddToChat}>
              Add to Chat
            </button>
          </div>
        )}
        {loading && <div className="diff-loading">Loading diff…</div>}
        {error && <div className="diff-error">{error}</div>}
        {!loading && !error && (
          <div
            ref={diffContentRef}
            className="diff-content"
            onContextMenu={handleContextMenu}
            dangerouslySetInnerHTML={{ __html: diffHtml }}
          />
        )}
      </div>
    </div>
  );
}
