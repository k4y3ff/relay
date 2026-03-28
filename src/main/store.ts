import Store from 'electron-store';
import type { PersistedTaskGroup } from '../renderer/types/repo.js';

interface StoreSchema {
  taskGroups: PersistedTaskGroup[];
}

export const store = new Store<StoreSchema>({
  defaults: {
    taskGroups: [],
  },
});
