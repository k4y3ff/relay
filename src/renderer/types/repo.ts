export interface Worktree {
  path: string;
  branch: string;   // display name, e.g. "main" (refs/heads/ stripped)
  isMain: boolean;  // true for the primary worktree
  isBare: boolean;
}

export type TaskType = 'branch' | 'manual';
export type TaskStatus = 'todo' | 'in-progress' | 'blocked' | 'done';

export interface BranchTask {
  id: string;
  type: 'branch';
  title: string;       // branch name, for display
  status: TaskStatus;  // auto-derived from git, user-overridable
  repoRootPath: string;
  repoName: string;
  worktree: Worktree;
}

export interface ManualTask {
  id: string;
  type: 'manual';
  title: string;
  status: TaskStatus;
}

export type Task = BranchTask | ManualTask;

export interface TaskGroup {
  id: string;
  name: string;
  tasks: Task[];
}

// Shapes stored in electron-store
export interface PersistedTask {
  id: string;
  type: TaskType;
  status: TaskStatus;
  title: string;
  repoRootPath?: string;  // branch tasks only
  worktreePath?: string;  // branch tasks only
}

export interface PersistedTaskGroup {
  id: string;
  name: string;
  tasks: PersistedTask[];
}

export interface ChangedFile {
  path: string;
  status: 'M' | 'A' | 'D' | '?' | 'R';
  added: number;
  deleted: number;
}
