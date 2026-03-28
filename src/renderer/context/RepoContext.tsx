import { createContext, useContext, useEffect, useReducer, useCallback, ReactNode } from 'react';
import type { TaskGroup, BranchEntry, ChangedFile } from '../types/repo';

// ── State ──────────────────────────────────────────────────────────────────

interface TaskGroupState {
  taskGroups: TaskGroup[];
  activeWorktreePath: string | null;
  activeDiffFile: ChangedFile | null;
  collapsedGroups: Set<string>;
  loading: boolean;
}

type Action =
  | { type: 'SET_TASK_GROUPS'; taskGroups: TaskGroup[] }
  | { type: 'ADD_TASK_GROUP'; group: TaskGroup }
  | { type: 'REMOVE_TASK_GROUP'; groupId: string }
  | { type: 'RENAME_TASK_GROUP'; groupId: string; name: string }
  | { type: 'ADD_BRANCH'; groupId: string; branch: BranchEntry }
  | { type: 'REMOVE_BRANCH'; groupId: string; worktreePath: string }
  | { type: 'SELECT_WORKTREE'; path: string | null }
  | { type: 'SET_DIFF_FILE'; file: ChangedFile | null }
  | { type: 'TOGGLE_COLLAPSED'; groupId: string }
  | { type: 'SET_LOADING'; loading: boolean };

function reducer(state: TaskGroupState, action: Action): TaskGroupState {
  switch (action.type) {
    case 'SET_TASK_GROUPS':
      return { ...state, taskGroups: action.taskGroups, loading: false };
    case 'ADD_TASK_GROUP':
      return { ...state, taskGroups: [...state.taskGroups, action.group] };
    case 'REMOVE_TASK_GROUP':
      return { ...state, taskGroups: state.taskGroups.filter((g) => g.id !== action.groupId) };
    case 'RENAME_TASK_GROUP':
      return {
        ...state,
        taskGroups: state.taskGroups.map((g) =>
          g.id === action.groupId ? { ...g, name: action.name } : g
        ),
      };
    case 'ADD_BRANCH':
      return {
        ...state,
        taskGroups: state.taskGroups.map((g) =>
          g.id === action.groupId
            ? { ...g, branches: [...g.branches, action.branch] }
            : g
        ),
      };
    case 'REMOVE_BRANCH':
      return {
        ...state,
        taskGroups: state.taskGroups.map((g) =>
          g.id === action.groupId
            ? { ...g, branches: g.branches.filter((b) => b.worktree.path !== action.worktreePath) }
            : g
        ),
        activeWorktreePath:
          state.activeWorktreePath === action.worktreePath ? null : state.activeWorktreePath,
      };
    case 'SELECT_WORKTREE':
      return { ...state, activeWorktreePath: action.path, activeDiffFile: null };
    case 'SET_DIFF_FILE':
      return { ...state, activeDiffFile: action.file };
    case 'TOGGLE_COLLAPSED': {
      const next = new Set(state.collapsedGroups);
      next.has(action.groupId) ? next.delete(action.groupId) : next.add(action.groupId);
      return { ...state, collapsedGroups: next };
    }
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    default:
      return state;
  }
}

const initialState: TaskGroupState = {
  taskGroups: [],
  activeWorktreePath: null,
  activeDiffFile: null as ChangedFile | null,
  collapsedGroups: new Set(),
  loading: true,
};

// ── Context ────────────────────────────────────────────────────────────────

interface TaskGroupContextValue extends TaskGroupState {
  createTaskGroup: (name: string) => Promise<TaskGroup>;
  removeTaskGroup: (groupId: string) => Promise<void>;
  renameTaskGroup: (groupId: string, name: string) => Promise<void>;
  addBranchToGroup: (groupId: string, folderPath: string, branchName: string, defaultBranch: string) => Promise<BranchEntry>;
  removeBranchFromGroup: (groupId: string, worktreePath: string, repoRootPath: string) => Promise<void>;
  selectWorktree: (path: string) => void;
  setActiveDiffFile: (file: ChangedFile | null) => void;
  toggleGroupCollapsed: (groupId: string) => void;
}

const TaskGroupContext = createContext<TaskGroupContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function RepoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    window.relay
      .invoke('taskgroups:list')
      .then((groups) => dispatch({ type: 'SET_TASK_GROUPS', taskGroups: groups as TaskGroup[] }))
      .catch(() => dispatch({ type: 'SET_LOADING', loading: false }));
  }, []);

  const createTaskGroup = useCallback(async (name: string): Promise<TaskGroup> => {
    const persisted = (await window.relay.invoke('taskgroups:create', { name })) as { id: string; name: string };
    const group: TaskGroup = { id: persisted.id, name: persisted.name, branches: [] };
    dispatch({ type: 'ADD_TASK_GROUP', group });
    return group;
  }, []);

  const removeTaskGroup = useCallback(async (groupId: string) => {
    await window.relay.invoke('taskgroups:remove', { groupId });
    dispatch({ type: 'REMOVE_TASK_GROUP', groupId });
  }, []);

  const renameTaskGroup = useCallback(async (groupId: string, name: string) => {
    await window.relay.invoke('taskgroups:rename', { groupId, name });
    dispatch({ type: 'RENAME_TASK_GROUP', groupId, name });
  }, []);

  const addBranchToGroup = useCallback(
    async (groupId: string, folderPath: string, branchName: string, defaultBranch: string): Promise<BranchEntry> => {
      const branch = (await window.relay.invoke('taskgroups:add-branch', {
        groupId,
        folderPath,
        branchName,
        defaultBranch,
      })) as BranchEntry;
      dispatch({ type: 'ADD_BRANCH', groupId, branch });
      dispatch({ type: 'SELECT_WORKTREE', path: branch.worktree.path });
      return branch;
    },
    []
  );

  const removeBranchFromGroup = useCallback(
    async (groupId: string, worktreePath: string, repoRootPath: string) => {
      await window.relay.invoke('taskgroups:remove-branch', { groupId, worktreePath, repoRootPath });
      dispatch({ type: 'REMOVE_BRANCH', groupId, worktreePath });
    },
    []
  );

  const selectWorktree = useCallback((path: string) => {
    dispatch({ type: 'SELECT_WORKTREE', path });
  }, []);

  const setActiveDiffFile = useCallback((file: ChangedFile | null) => {
    dispatch({ type: 'SET_DIFF_FILE', file });
  }, []);

  const toggleGroupCollapsed = useCallback((groupId: string) => {
    dispatch({ type: 'TOGGLE_COLLAPSED', groupId });
  }, []);

  return (
    <TaskGroupContext.Provider
      value={{
        ...state,
        createTaskGroup,
        removeTaskGroup,
        renameTaskGroup,
        addBranchToGroup,
        removeBranchFromGroup,
        selectWorktree,
        setActiveDiffFile,
        toggleGroupCollapsed,
      }}
    >
      {children}
    </TaskGroupContext.Provider>
  );
}

export function useRepo(): TaskGroupContextValue {
  const ctx = useContext(TaskGroupContext);
  if (!ctx) throw new Error('useRepo must be used within RepoProvider');
  return ctx;
}

// Alias for clarity in new code
export const useTaskGroups = useRepo;
