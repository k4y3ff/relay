import { useEffect, useRef, useCallback, useState } from 'react';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import { dracula } from '@uiw/codemirror-theme-dracula';
import { nord } from '@uiw/codemirror-theme-nord';
import { solarizedDark, solarizedLight } from '@uiw/codemirror-theme-solarized';
import { javascript } from '@codemirror/lang-javascript';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { markdown } from '@codemirror/lang-markdown';
import { StreamLanguage } from '@codemirror/language';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { yaml } from '@codemirror/legacy-modes/mode/yaml';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import { useRepo } from '../../context/RepoContext';
import { spawnSparkles } from '../../lib/sparkles';

interface Props {
  worktreePath: string;
  filePath: string;
}

function getThemeExtension(themeId: string) {
  switch (themeId) {
    case 'github-dark': return githubDark;
    case 'github-light': return githubLight;
    case 'dracula': return dracula;
    case 'nord': return nord;
    case 'solarized-dark': return solarizedDark;
    case 'solarized-light': return solarizedLight;
    default: return oneDark;
  }
}

function getLanguageExtension(ext: string) {
  switch (ext.toLowerCase()) {
    case 'js': case 'jsx': case 'mjs': case 'cjs':
      return javascript({ jsx: true });
    case 'ts': case 'tsx':
      return javascript({ typescript: true, jsx: ext === 'tsx' });
    case 'css': return css();
    case 'html': case 'htm': return html();
    case 'json': case 'jsonc': return json();
    case 'py': return python();
    case 'rs': return rust();
    case 'c': case 'cc': case 'cpp': case 'cxx': case 'h': case 'hpp':
      return cpp();
    case 'java': return java();
    case 'md': case 'mdx': return markdown();
    case 'sh': case 'bash': case 'zsh': return StreamLanguage.define(shell);
    case 'yaml': case 'yml': return StreamLanguage.define(yaml);
    case 'toml': return StreamLanguage.define(toml);
    default: return null;
  }
}

export default function FileViewer({ worktreePath, filePath }: Props) {
  const { dirtyTabs, markTabDirty, markTabClean } = useRepo();
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompartment = useRef(new Compartment());
  const wrapCompartment = useRef(new Compartment());
  const pendingFocusRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBinary, setIsBinary] = useState(false);
  const [themeId, setThemeId] = useState('one-dark');
  const [wordWrap, setWordWrap] = useState(false);
  const isDirty = dirtyTabs.has(filePath);

  // Load saved settings on mount
  useEffect(() => {
    window.relay.invoke('settings:get-editor-theme').then((val) => {
      setThemeId(val as string);
    });
    window.relay.invoke('settings:get-editor-word-wrap').then((val) => {
      setWordWrap(val as boolean);
    });
  }, []);

  // Listen for live theme changes from Settings
  useEffect(() => {
    function handleThemeChange(e: Event) {
      const newThemeId = (e as CustomEvent<string>).detail;
      setThemeId(newThemeId);
      if (viewRef.current) {
        viewRef.current.dispatch({
          effects: themeCompartment.current.reconfigure(getThemeExtension(newThemeId)),
        });
      }
    }
    window.addEventListener('settings:editor-theme-changed', handleThemeChange);
    return () => window.removeEventListener('settings:editor-theme-changed', handleThemeChange);
  }, []);

  // Listen for live word wrap changes from Settings
  useEffect(() => {
    function handleWrapChange(e: Event) {
      const enabled = (e as CustomEvent<boolean>).detail;
      setWordWrap(enabled);
      if (viewRef.current) {
        viewRef.current.dispatch({
          effects: wrapCompartment.current.reconfigure(enabled ? EditorView.lineWrapping : []),
        });
      }
    }
    window.addEventListener('settings:editor-word-wrap-changed', handleWrapChange);
    return () => window.removeEventListener('settings:editor-word-wrap-changed', handleWrapChange);
  }, []);

  // viewer:focus: focus immediately if editor is ready, otherwise queue it
  useEffect(() => {
    const handler = () => {
      if (viewRef.current) viewRef.current.focus();
      else pendingFocusRef.current = true;
    };
    window.addEventListener('viewer:focus', handler);
    return () => window.removeEventListener('viewer:focus', handler);
  }, []);

  const save = useCallback(async () => {
    if (!viewRef.current) return;
    const content = viewRef.current.state.doc.toString();
    try {
      await window.relay.invoke('fs:write-file', { worktreePath, filePath, content });
      markTabClean(filePath);
    } catch (err) {
      console.error('Failed to save file:', err);
    }
  }, [worktreePath, filePath, markTabClean]);

  useEffect(() => {
    let stale = false;
    setLoading(true);
    setError(null);
    setIsBinary(false);

    window.relay
      .invoke('fs:read-file', { worktreePath, filePath })
      .then((result) => {
        if (stale) return;
        const { content, isBinary: binary } = result as { content: string; isBinary: boolean };
        setLoading(false);
        if (binary) {
          setIsBinary(true);
          return;
        }

        const ext = filePath.split('.').pop() ?? '';
        const langExt = getLanguageExtension(ext);

        const extensions = [
          themeCompartment.current.of(getThemeExtension(themeId)),
          wrapCompartment.current.of(wordWrap ? EditorView.lineWrapping : []),
          history(),
          lineNumbers(),
          highlightActiveLine(),
          bracketMatching(),
          indentOnInput(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
            { key: 'Mod-s', run: () => { save(); return true; } },
          ]),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            markTabDirty(filePath);
            const head = update.state.selection.main.head;
            const coords = update.view.coordsAtPos(head);
            if (coords) spawnSparkles(coords.left, coords.bottom);
          }),
          EditorView.theme({
            '&': { height: '100%', width: '100%' },
            '.cm-scroller': { overflow: 'auto' },
          }),
        ];

        if (langExt) extensions.push(langExt);

        const state = EditorState.create({ doc: content, extensions });
        const view = new EditorView({ state, parent: editorRef.current! });
        viewRef.current = view;
        if (pendingFocusRef.current) {
          pendingFocusRef.current = false;
          view.focus();
        }
      })
      .catch((err: unknown) => {
        if (stale) return;
        setLoading(false);
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      stale = true;
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
    // save is intentionally excluded — recreating the editor on save reference change is wrong
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worktreePath, filePath]);

  return (
    <div className="diff-viewer">
      <div className="diff-viewer-header">
        <span className="diff-filepath">{filePath}</span>
        {isDirty && (
          <button className="file-editor-save-btn" onClick={save}>
            Save
          </button>
        )}
      </div>
      <div className="diff-viewer-body file-editor-body">
        {loading && <div className="diff-loading">Loading…</div>}
        {error && <div className="diff-error">{error}</div>}
        {isBinary && <div className="diff-loading">Binary file — cannot edit</div>}
        <div
          ref={editorRef}
          style={{ display: loading || error || isBinary ? 'none' : 'block', flex: 1, minHeight: 0, overflow: 'hidden' }}
        />
      </div>
    </div>
  );
}
