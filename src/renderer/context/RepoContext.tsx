import { createContext, useContext, useEffect, useReducer, useCallback, ReactNode } from 'react';
import type { TaskGroup, Task, BranchTask, ManualTask, TaskStatus, ChangedFile } from '../types/repo';

// ── State ──────────────────────────────────────────────────────────────────

interface TaskGroupState {
  taskGroups: TaskGroup[];
  activeWorktreePath: string | null;
  activeManualTaskId: string | null;
  diffTabs: ChangedFile[];
  activePaneTab: 'chat' | string;
  collapsedGroups: Set<string>;
  dirtyTabs: Set<string>;
  runningWorktreePaths: Set<string>;
  pendingReviewPaths: Set<string>;
  loading: boolean;
}

type Action =
  | { type: 'SET_TASK_GROUPS'; taskGroups: TaskGroup[] }
  | { type: 'ADD_TASK_GROUP'; group: TaskGroup }
  | { type: 'REMOVE_TASK_GROUP'; groupId: string }
  | { type: 'RENAME_TASK_GROUP'; groupId: string; name: string }
  | { type: 'ADD_TASK'; groupId: string; task: Task }
  | { type: 'REMOVE_TASK'; groupId: string; taskId: string }
  | { type: 'UPDATE_TASK_STATUS'; groupId: string; taskId: string; status: TaskStatus }
  | { type: 'RENAME_TASK'; groupId: string; taskId: string; title: string }
  | { type: 'MOVE_TASK'; fromGroupId: string; taskId: string; toGroupId: string; insertIndex: number }
  | { type: 'SELECT_WORKTREE'; path: string | null }
  | { type: 'SELECT_MANUAL_TASK'; taskId: string }
  | { type: 'UPDATE_TASK_NOTES'; groupId: string; taskId: string; notes: string }
  | { type: 'OPEN_DIFF_TAB'; file: ChangedFile }
  | { type: 'CLOSE_DIFF_TAB'; filePath: string }
  | { type: 'SELECT_PANE_TAB'; tabId: string }
  | { type: 'TOGGLE_COLLAPSED'; groupId: string }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'MARK_TAB_DIRTY'; filePath: string }
  | { type: 'MARK_TAB_CLEAN'; filePath: string }
  | { type: 'CLAUDE_RUNNING'; worktreePath: string }
  | { type: 'CLAUDE_DONE'; worktreePath: string };

function reducer(state: TaskGroupState, action: Action): TaskGroupState {
  switch (action.type) {
    case 'SET_TASK_GROUPS':
      return { ...state, taskGroups: action.taskGroups, loading: false };
    case 'ADD_TASK_GROUP':
      return { ...state, taskGroups: [...state.taskGroups, action.group] };
    case 'REMOVE_TASK_GROUP': {
      const removedGroup = state.taskGroups.find((g) => g.id === action.groupId);
      const groupHadActiveTask = removedGroup?.tasks.some((t) => t.id === state.activeManualTaskId) ?? false;
      return {
        ...state,
        taskGroups: state.taskGroups.filter((g) => g.id !== action.groupId),
        activeManualTaskId: groupHadActiveTask ? null : state.activeManualTaskId,
      };
    }
    case 'RENAME_TASK_GROUP':
      return {
        ...state,
        taskGroups: state.taskGroups.map((g) =>
          g.id === action.groupId ? { ...g, name: action.name } : g
        ),
      };
    case 'ADD_TASK':
      return {
        ...state,
        taskGroups: state.taskGroups.map((g) =>
          g.id === action.groupId
            ? { ...g, tasks: [...g.tasks, action.task] }
            : g
        ),
      };
    case 'REMOVE_TASK': {
      // If removing the active branch task, clear active worktree
      const group = state.taskGroups.find((g) => g.id === action.groupId);
      const task = group?.tasks.find((t) => t.id === action.taskId);
      const removedPath = task?.type === 'branch' ? task.worktree.path : null;
      return {
        ...state,
        taskGroups: state.taskGroups.map((g) =>
          g.id === action.groupId
            ? { ...g, tasks: g.tasks.filter((t) => t.id !== action.taskId) }
            : g
        ),
        activeWorktreePath:
          removedPath && state.activeWorktreePath === removedPath ? null : state.activeWorktreePath,
        activeManualTaskId:
          state.activeManualTaskId === action.taskId ? null : state.activeManualTaskId,
      };
    }
    case 'UPDATE_TASK_STATUS':
      return {
        ...state,
        taskGroups: state.taskGroups.map((g) =>
          g.id === action.groupId
            ? { ...g, tasks: g.tasks.map((t) => t.id === action.taskId ? { ...t, status: action.status } : t) }
            : g
        ),
      };
    case 'RENAME_TASK':
      return {
        ...state,
        taskGroups: state.taskGroups.map((g) =>
          g.id === action.groupId
            ? { ...g, tasks: g.tasks.map((t) => t.id === action.taskId ? { ...t, title: action.title } : t) }
            : g
        ),
      };
    case 'MOVE_TASK': {
      const { fromGroupId, taskId, toGroupId, insertIndex } = action;
      if (fromGroupId === toGroupId) {
        return {
          ...state,
          taskGroups: state.taskGroups.map((g) => {
            if (g.id !== fromGroupId) return g;
            const tasks = [...g.tasks];
            const fromIndex = tasks.findIndex((t) => t.id === taskId);
            if (fromIndex === -1) return g;
            const [task] = tasks.splice(fromIndex, 1);
            tasks.splice(insertIndex, 0, task);
            return { ...g, tasks };
          }),
        };
      } else {
        let movedTask: Task | undefined;
        const withRemoved = state.taskGroups.map((g) => {
          if (g.id !== fromGroupId) return g;
          movedTask = g.tasks.find((t) => t.id === taskId);
          return { ...g, tasks: g.tasks.filter((t) => t.id !== taskId) };
        });
        if (!movedTask) return state;
        const task = movedTask;
        return {
          ...state,
          taskGroups: withRemoved.map((g) => {
            if (g.id !== toGroupId) return g;
            const tasks = [...g.tasks];
            tasks.splice(insertIndex, 0, task);
            return { ...g, tasks };
          }),
        };
      }
    }
    case 'SELECT_WORKTREE': {
      const pendingReview = new Set(state.pendingReviewPaths);
      if (action.path) pendingReview.delete(action.path);
      return { ...state, activeWorktreePath: action.path, activeManualTaskId: null, diffTabs: [], activePaneTab: 'chat', dirtyTabs: new Set(), pendingReviewPaths: pendingReview };
    }
    case 'SELECT_MANUAL_TASK':
      return { ...state, activeManualTaskId: action.taskId, activeWorktreePath: null, diffTabs: [], activePaneTab: 'chat', dirtyTabs: new Set() };
    case 'UPDATE_TASK_NOTES':
      return {
        ...state,
        taskGroups: state.taskGroups.map((g) =>
          g.id === action.groupId
            ? { ...g, tasks: g.tasks.map((t) => t.id === action.taskId ? { ...t, notes: action.notes } : t) }
            : g
        ),
      };
    case 'OPEN_DIFF_TAB': {
      const already = state.diffTabs.some((t) => t.path === action.file.path);
      return {
        ...state,
        diffTabs: already ? state.diffTabs : [...state.diffTabs, action.file],
        activePaneTab: action.file.path,
      };
    }
    case 'CLOSE_DIFF_TAB': {
      const idx = state.diffTabs.findIndex((t) => t.path === action.filePath);
      if (idx === -1) return state;
      const newTabs = state.diffTabs.filter((t) => t.path !== action.filePath);
      let newActive = state.activePaneTab;
      if (state.activePaneTab === action.filePath) {
        newActive = newTabs[Math.max(0, idx - 1)]?.path ?? 'chat';
      }
      const newDirtyTabs = new Set(state.dirtyTabs);
      newDirtyTabs.delete(action.filePath);
      return { ...state, diffTabs: newTabs, activePaneTab: newActive, dirtyTabs: newDirtyTabs };
    }
    case 'MARK_TAB_DIRTY': {
      const next = new Set(state.dirtyTabs);
      next.add(action.filePath);
      return { ...state, dirtyTabs: next };
    }
    case 'MARK_TAB_CLEAN': {
      const next = new Set(state.dirtyTabs);
      next.delete(action.filePath);
      return { ...state, dirtyTabs: next };
    }
    case 'SELECT_PANE_TAB':
      return { ...state, activePaneTab: action.tabId };
    case 'TOGGLE_COLLAPSED': {
      const next = new Set(state.collapsedGroups);
      next.has(action.groupId) ? next.delete(action.groupId) : next.add(action.groupId);
      return { ...state, collapsedGroups: next };
    }
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'CLAUDE_RUNNING': {
      const running = new Set(state.runningWorktreePaths);
      running.add(action.worktreePath);
      const pendingReview = new Set(state.pendingReviewPaths);
      pendingReview.delete(action.worktreePath);
      return { ...state, runningWorktreePaths: running, pendingReviewPaths: pendingReview };
    }
    case 'CLAUDE_DONE': {
      const running = new Set(state.runningWorktreePaths);
      running.delete(action.worktreePath);
      const pendingReview = new Set(state.pendingReviewPaths);
      pendingReview.add(action.worktreePath);
      return { ...state, runningWorktreePaths: running, pendingReviewPaths: pendingReview };
    }
    default:
      return state;
  }
}

const initialState: TaskGroupState = {
  taskGroups: [],
  activeWorktreePath: null,
  activeManualTaskId: null,
  diffTabs: [],
  activePaneTab: 'chat',
  collapsedGroups: new Set(),
  dirtyTabs: new Set(),
  runningWorktreePaths: new Set(),
  pendingReviewPaths: new Set(),
  loading: true,
};

// ── Context ────────────────────────────────────────────────────────────────

interface TaskGroupContextValue extends TaskGroupState {
  createTaskGroup: (name: string) => Promise<TaskGroup>;
  removeTaskGroup: (groupId: string) => Promise<void>;
  renameTaskGroup: (groupId: string, name: string) => Promise<void>;
  addBranchToGroup: (groupId: string, folderPath: string, branchName: string, defaultBranch: string) => Promise<BranchTask>;
  addManualTask: (groupId: string, title: string) => Promise<ManualTask>;
  removeTask: (groupId: string, taskId: string) => Promise<void>;
  updateTaskStatus: (groupId: string, taskId: string, status: TaskStatus) => Promise<void>;
  renameTask: (groupId: string, taskId: string, title: string) => Promise<void>;
  moveTask: (fromGroupId: string, taskId: string, toGroupId: string, insertIndex: number) => Promise<void>;
  selectWorktree: (path: string) => void;
  selectManualTask: (taskId: string) => void;
  updateTaskNotes: (groupId: string, taskId: string, notes: string) => Promise<void>;
  openDiffTab: (file: ChangedFile) => void;
  closeDiffTab: (filePath: string) => void;
  selectPaneTab: (tabId: string) => void;
  toggleGroupCollapsed: (groupId: string) => void;
  markTabDirty: (filePath: string) => void;
  markTabClean: (filePath: string) => void;
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

  useEffect(() => {
    return window.relay.on('navigate:worktree', (payload) => {
      const { worktreePath } = payload as { worktreePath: string };
      dispatch({ type: 'SELECT_WORKTREE', path: worktreePath });
    });
  }, []);

  useEffect(() => {
    const offStart = window.relay.on('response:start', (payload) => {
      const { worktreePath } = payload as { worktreePath: string };
      dispatch({ type: 'CLAUDE_RUNNING', worktreePath });
    });
    const offDone = window.relay.on('response:complete', (payload) => {
      const { worktreePath } = payload as { worktreePath: string };
      dispatch({ type: 'CLAUDE_DONE', worktreePath });
    });
    return () => { offStart(); offDone(); };
  }, []);

  const createTaskGroup = useCallback(async (name: string): Promise<TaskGroup> => {
    const persisted = (await window.relay.invoke('taskgroups:create', { name })) as { id: string; name: string };
    const group: TaskGroup = { id: persisted.id, name: persisted.name, tasks: [] };
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
    async (groupId: string, folderPath: string, branchName: string, defaultBranch: string): Promise<BranchTask> => {
      const task = (await window.relay.invoke('taskgroups:add-branch', {
        groupId,
        folderPath,
        branchName,
        defaultBranch,
      })) as BranchTask;
      dispatch({ type: 'ADD_TASK', groupId, task });
      dispatch({ type: 'SELECT_WORKTREE', path: task.worktree.path });
      return task;
    },
    []
  );

  const addManualTask = useCallback(async (groupId: string, title: string): Promise<ManualTask> => {
    const task = (await window.relay.invoke('taskgroups:add-manual-task', { groupId, title })) as ManualTask;
    dispatch({ type: 'ADD_TASK', groupId, task });
    return task;
  }, []);

  const removeTask = useCallback(async (groupId: string, taskId: string) => {
    await window.relay.invoke('taskgroups:remove-task', { groupId, taskId });
    dispatch({ type: 'REMOVE_TASK', groupId, taskId });
  }, []);

  const updateTaskStatus = useCallback(async (groupId: string, taskId: string, status: TaskStatus) => {
    await window.relay.invoke('taskgroups:update-task-status', { groupId, taskId, status });
    dispatch({ type: 'UPDATE_TASK_STATUS', groupId, taskId, status });
  }, []);

  const moveTask = useCallback(async (fromGroupId: string, taskId: string, toGroupId: string, insertIndex: number) => {
    await window.relay.invoke('taskgroups:move-task', { fromGroupId, taskId, toGroupId, insertIndex });
    dispatch({ type: 'MOVE_TASK', fromGroupId, taskId, toGroupId, insertIndex });
  }, []);

  const renameTask = useCallback(async (groupId: string, taskId: string, title: string) => {
    await window.relay.invoke('taskgroups:rename-task', { groupId, taskId, title });
    dispatch({ type: 'RENAME_TASK', groupId, taskId, title });
  }, []);

  const selectWorktree = useCallback((path: string) => {
    dispatch({ type: 'SELECT_WORKTREE', path });
  }, []);

  const selectManualTask = useCallback((taskId: string) => {
    dispatch({ type: 'SELECT_MANUAL_TASK', taskId });
  }, []);

  const updateTaskNotes = useCallback(async (groupId: string, taskId: string, notes: string) => {
    await window.relay.invoke('taskgroups:update-task-notes', { groupId, taskId, notes });
    dispatch({ type: 'UPDATE_TASK_NOTES', groupId, taskId, notes });
  }, []);

  const openDiffTab = useCallback((file: ChangedFile) => {
    dispatch({ type: 'OPEN_DIFF_TAB', file });
  }, []);

  const closeDiffTab = useCallback((filePath: string) => {
    dispatch({ type: 'CLOSE_DIFF_TAB', filePath });
  }, []);

  const selectPaneTab = useCallback((tabId: string) => {
    dispatch({ type: 'SELECT_PANE_TAB', tabId });
  }, []);

  const toggleGroupCollapsed = useCallback((groupId: string) => {
    dispatch({ type: 'TOGGLE_COLLAPSED', groupId });
  }, []);

  const markTabDirty = useCallback((filePath: string) => {
    dispatch({ type: 'MARK_TAB_DIRTY', filePath });
  }, []);

  const markTabClean = useCallback((filePath: string) => {
    dispatch({ type: 'MARK_TAB_CLEAN', filePath });
  }, []);

  return (
    <TaskGroupContext.Provider
      value={{
        ...state,
        createTaskGroup,
        removeTaskGroup,
        renameTaskGroup,
        addBranchToGroup,
        addManualTask,
        removeTask,
        updateTaskStatus,
        renameTask,
        moveTask,
        selectWorktree,
        selectManualTask,
        updateTaskNotes,
        openDiffTab,
        closeDiffTab,
        selectPaneTab,
        toggleGroupCollapsed,
        markTabDirty,
        markTabClean,
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
