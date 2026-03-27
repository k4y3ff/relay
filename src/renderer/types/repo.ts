export interface Worktree {
  path: string;
  branch: string;   // display name, e.g. "main" (refs/heads/ stripped)
  isMain: boolean;  // true for the primary worktree
  isBare: boolean;
}

export interface Repo {
  id: string;         // equals rootPath — stable, unique
  rootPath: string;   // absolute path to main worktree
  name: string;       // path.basename(rootPath)
  remote: string | null;  // e.g. "https://github.com/owner/repo.git"
  worktrees: Worktree[];
}

// Shape stored in electron-store
export interface PersistedRepo {
  id: string;
  rootPath: string;
}
