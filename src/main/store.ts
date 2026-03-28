import Store from 'electron-store';
import type { PersistedTaskGroup } from '../renderer/types/repo.js';

interface StoreSchema {
  taskGroups: PersistedTaskGroup[];
  worktreesDir: string | null;
  repoDefaults: Record<string, string>;
  notificationsEnabled: boolean;
  soundEffectsEnabled: boolean;
}

export const store = new Store<StoreSchema>({
  defaults: {
    taskGroups: [],
    worktreesDir: null,
    repoDefaults: {},
    notificationsEnabled: true,
    soundEffectsEnabled: true,
  },
});
