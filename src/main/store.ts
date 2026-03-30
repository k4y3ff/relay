import Store from 'electron-store';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { PersistedTaskGroup, PersistedTask } from '../renderer/types/repo.js';

interface StoreSchema {
  taskGroups: PersistedTaskGroup[];
  worktreesDir: string | null;
  repoDefaults: Record<string, string>;
  notificationsEnabled: boolean;
  soundEffectsEnabled: boolean;
  customSoundPath: string | null;
  appTheme: string;
  editorTheme: string;
  editorWordWrap: boolean;
  confettiEnabled: boolean;
}

export const store = new Store<StoreSchema>({
  defaults: {
    taskGroups: [],
    worktreesDir: null,
    repoDefaults: {},
    notificationsEnabled: true,
    soundEffectsEnabled: true,
    customSoundPath: null,
    appTheme: 'dark',
    editorTheme: 'one-dark',
    editorWordWrap: false,
    confettiEnabled: false,
  },
});

// Migrate old shape (branches: PersistedBranch[]) to new shape (tasks: PersistedTask[])
export function migrateStore(): void {
  const groups = store.get('taskGroups') as unknown as Array<{
    id: string;
    name: string;
    tasks?: PersistedTask[];
    branches?: Array<{ repoRootPath: string; worktreePath: string }>;
  }>;

  let needsSave = false;
  const migrated: PersistedTaskGroup[] = groups.map((g) => {
    if (g.tasks !== undefined) {
      return g as PersistedTaskGroup;
    }
    // Old shape — convert branches to tasks
    needsSave = true;
    const tasks: PersistedTask[] = (g.branches ?? []).map((b) => ({
      id: randomUUID(),
      type: 'branch',
      status: 'todo',
      title: path.basename(b.worktreePath),
      repoRootPath: b.repoRootPath,
      worktreePath: b.worktreePath,
    }));
    return { id: g.id, name: g.name, tasks };
  });

  if (needsSave) {
    store.set('taskGroups', migrated);
  }
}
