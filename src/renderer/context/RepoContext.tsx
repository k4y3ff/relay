import { createContext, useContext, useEffect, useReducer, useCallback, ReactNode } from 'react';
import type { Repo, Worktree, ChangedFile } from '../types/repo';

// ── State ──────────────────────────────────────────────────────────────────

interface RepoState {
  repos: Repo[];
  activeWorktreePath: string | null;
  activeDiffFile: ChangedFile | null;
  collapsedRepos: Set<string>;
  loading: boolean;
}

type Action =
  | { type: 'SET_REPOS'; repos: Repo[] }
  | { type: 'ADD_REPO'; repo: Repo }
  | { type: 'REMOVE_REPO'; repoId: string }
  | { type: 'ADD_WORKTREE'; repoId: string; worktree: Worktree }
  | { type: 'REMOVE_WORKTREE'; repoId: string; worktreePath: string }
  | { type: 'SELECT_WORKTREE'; path: string | null }
  | { type: 'SET_DIFF_FILE'; file: ChangedFile | null }
  | { type: 'TOGGLE_COLLAPSED'; repoId: string }
  | { type: 'SET_LOADING'; loading: boolean };

function reducer(state: RepoState, action: Action): RepoState {
  switch (action.type) {
    case 'SET_REPOS':
      return { ...state, repos: action.repos, loading: false };
    case 'ADD_REPO':
      return { ...state, repos: [...state.repos, action.repo] };
    case 'REMOVE_REPO':
      return { ...state, repos: state.repos.filter((r) => r.id !== action.repoId) };
    case 'ADD_WORKTREE':
      return {
        ...state,
        repos: state.repos.map((r) =>
          r.id === action.repoId
            ? { ...r, worktrees: [...r.worktrees, action.worktree] }
            : r
        ),
      };
    case 'REMOVE_WORKTREE':
      return {
        ...state,
        repos: state.repos.map((r) =>
          r.id === action.repoId
            ? { ...r, worktrees: r.worktrees.filter((wt) => wt.path !== action.worktreePath) }
            : r
        ),
        activeWorktreePath:
          state.activeWorktreePath === action.worktreePath ? null : state.activeWorktreePath,
      };
    case 'SELECT_WORKTREE':
      return { ...state, activeWorktreePath: action.path, activeDiffFile: null };
    case 'SET_DIFF_FILE':
      return { ...state, activeDiffFile: action.file };
    case 'TOGGLE_COLLAPSED': {
      const next = new Set(state.collapsedRepos);
      next.has(action.repoId) ? next.delete(action.repoId) : next.add(action.repoId);
      return { ...state, collapsedRepos: next };
    }
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    default:
      return state;
  }
}

const initialState: RepoState = {
  repos: [],
  activeWorktreePath: null,
  activeDiffFile: null as ChangedFile | null,
  collapsedRepos: new Set(),
  loading: true,
};

// ── Context ────────────────────────────────────────────────────────────────

interface RepoContextValue extends RepoState {
  addRepo: () => Promise<void>;
  removeRepo: (repoId: string) => Promise<void>;
  addWorktree: (repoId: string, branchName: string, createNew: boolean) => Promise<Worktree>;
  removeWorktree: (repoId: string, worktreePath: string) => Promise<void>;
  selectWorktree: (path: string) => void;
  setActiveDiffFile: (file: ChangedFile | null) => void;
  toggleRepoCollapsed: (repoId: string) => void;
}

const RepoContext = createContext<RepoContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function RepoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    window.relay
      .invoke('repos:list')
      .then((repos) => dispatch({ type: 'SET_REPOS', repos: repos as Repo[] }))
      .catch(() => dispatch({ type: 'SET_LOADING', loading: false }));
  }, []);

  const addRepo = useCallback(async () => {
    const folderPath = await window.relay.invoke('dialog:open-folder');
    if (!folderPath) return;
    const repo = (await window.relay.invoke('repos:add', { folderPath })) as Repo;
    dispatch({ type: 'ADD_REPO', repo });
  }, []);

  const removeRepo = useCallback(async (repoId: string) => {
    await window.relay.invoke('repos:remove', { repoId });
    dispatch({ type: 'REMOVE_REPO', repoId });
  }, []);

  const addWorktree = useCallback(
    async (repoId: string, branchName: string, createNew: boolean): Promise<Worktree> => {
      const worktree = (await window.relay.invoke('worktrees:add', {
        repoId,
        branchName,
        createNew,
      })) as Worktree;
      dispatch({ type: 'ADD_WORKTREE', repoId, worktree });
      dispatch({ type: 'SELECT_WORKTREE', path: worktree.path });
      return worktree;
    },
    []
  );

  const removeWorktree = useCallback(async (repoId: string, worktreePath: string) => {
    await window.relay.invoke('worktrees:remove', { repoId, worktreePath });
    dispatch({ type: 'REMOVE_WORKTREE', repoId, worktreePath });
  }, []);

  const selectWorktree = useCallback((path: string) => {
    dispatch({ type: 'SELECT_WORKTREE', path });
  }, []);

  const setActiveDiffFile = useCallback((file: ChangedFile | null) => {
    dispatch({ type: 'SET_DIFF_FILE', file });
  }, []);

  const toggleRepoCollapsed = useCallback((repoId: string) => {
    dispatch({ type: 'TOGGLE_COLLAPSED', repoId });
  }, []);

  return (
    <RepoContext.Provider
      value={{
        ...state,
        addRepo,
        removeRepo,
        addWorktree,
        removeWorktree,
        selectWorktree,
        setActiveDiffFile,
        toggleRepoCollapsed,
      }}
    >
      {children}
    </RepoContext.Provider>
  );
}

export function useRepo(): RepoContextValue {
  const ctx = useContext(RepoContext);
  if (!ctx) throw new Error('useRepo must be used within RepoProvider');
  return ctx;
}
