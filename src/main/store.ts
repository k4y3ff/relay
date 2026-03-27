import Store from 'electron-store';
import type { PersistedRepo } from '../renderer/types/repo.js';
import type { ChatMessage } from '../renderer/types/chat.js';

interface StoreSchema {
  repos: PersistedRepo[];
  chatSessions: Record<string, ChatMessage[]>;
}

export const store = new Store<StoreSchema>({
  defaults: {
    repos: [],
    chatSessions: {},
  },
});
