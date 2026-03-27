import Store from 'electron-store';
import type { PersistedRepo } from '../renderer/types/repo.js';

interface StoreSchema {
  repos: PersistedRepo[];
}

export const store = new Store<StoreSchema>({
  defaults: {
    repos: [],
  },
});
