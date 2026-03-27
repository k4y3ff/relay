import Store from 'electron-store';
import type { PersistedRepo } from '../renderer/types/repo.js';
import type { PersistedChatSession } from '../renderer/types/chat.js';

interface StoreSchema {
  repos: PersistedRepo[];
  chatSessions: PersistedChatSession[];
}

export const store = new Store<StoreSchema>({
  defaults: {
    repos: [],
    chatSessions: [],
  },
});
