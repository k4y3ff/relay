import Store from 'electron-store';
import type { PersistedTaskGroup } from '../renderer/types/repo.js';

interface StoreSchema {
  taskGroups: PersistedTaskGroup[];
  worktreesDir: string | null;
}

export const store = new Store<StoreSchema>({
  defaults: {
    taskGroups: [],
    worktreesDir: null,
  },
});
