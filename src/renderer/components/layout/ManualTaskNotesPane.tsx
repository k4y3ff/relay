import { useEffect, useRef } from 'react';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import { dracula } from '@uiw/codemirror-theme-dracula';
import { nord } from '@uiw/codemirror-theme-nord';
import { solarizedDark, solarizedLight } from '@uiw/codemirror-theme-solarized';
import type { ManualTask } from '../../types/repo';
import { useRepo } from '../../context/RepoContext';
import { spawnSparkles } from '../../lib/sparkles';

interface ManualTaskNotesPaneProps {
  groupId: string;
  task: ManualTask;
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

export default function ManualTaskNotesPane({ groupId, task }: ManualTaskNotesPaneProps) {
  const { updateTaskNotes } = useRepo();
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompartment = useRef(new Compartment());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFocusRef = useRef(false);

  // notes:focus: focus immediately if the editor is ready, otherwise queue it
  useEffect(() => {
    const handler = () => {
      if (viewRef.current) viewRef.current.focus();
      else pendingFocusRef.current = true;
    };
    window.addEventListener('notes:focus', handler);
    return () => window.removeEventListener('notes:focus', handler);
  }, []);

  // Listen for live theme changes
  useEffect(() => {
    function handleThemeChange(e: Event) {
      const newThemeId = (e as CustomEvent<string>).detail;
      if (viewRef.current) {
        viewRef.current.dispatch({
          effects: themeCompartment.current.reconfigure(getThemeExtension(newThemeId)),
        });
      }
    }
    window.addEventListener('settings:editor-theme-changed', handleThemeChange);
    return () => window.removeEventListener('settings:editor-theme-changed', handleThemeChange);
  }, []);

  // Create/recreate editor when task changes, fetching the current theme first
  useEffect(() => {
    if (!editorRef.current) return;
    let stale = false;

    const saveNotes = (notes: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void updateTaskNotes(groupId, task.id, notes);
      }, 500);
    };

    window.relay.invoke('settings:get-editor-theme').then((val) => {
      if (stale || !editorRef.current) return;
      const themeId = val as string;

      const state = EditorState.create({
        doc: task.notes ?? '',
        extensions: [
          themeCompartment.current.of(getThemeExtension(themeId)),
          history(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          markdown(),
          EditorView.lineWrapping,
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            saveNotes(update.state.doc.toString());
            const head = update.state.selection.main.head;
            const coords = update.view.coordsAtPos(head);
            if (coords) spawnSparkles(coords.left, coords.bottom);
          }),
          EditorView.theme({
            '&': { height: '100%', width: '100%' },
            '.cm-scroller': { overflow: 'auto' },
            '.cm-content': { padding: '12px 16px' },
            '.cm-line': { padding: '0' },
          }),
        ],
      });

      const view = new EditorView({ state, parent: editorRef.current });
      viewRef.current = view;
      if (pendingFocusRef.current) {
        pendingFocusRef.current = false;
        view.focus();
      }
    });

    return () => {
      stale = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id, groupId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--color-mac-border)',
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--color-mac-text)',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        {task.title}
      </div>
      <div ref={editorRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }} />
    </div>
  );
}
