export interface Worktree {
  path: string;
  branch: string;   // display name, e.g. "main" (refs/heads/ stripped)
  isMain: boolean;  // true for the primary worktree
  isBare: boolean;
}

export interface BranchEntry {
  repoRootPath: string;  // absolute path to repo root (used for git ops)
  repoName: string;      // basename of repoRootPath, for display
  worktree: Worktree;
}

export interface TaskGroup {
  id: string;
  name: string;
  branches: BranchEntry[];
}

// Shapes stored in electron-store
export interface PersistedBranch {
  repoRootPath: string;
  worktreePath: string;
}

export interface PersistedTaskGroup {
  id: string;
  name: string;
  branches: PersistedBranch[];
}

export interface ChangedFile {
  path: string;
  status: 'M' | 'A' | 'D' | '?' | 'R';
  added: number;
  deleted: number;
}
