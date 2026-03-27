import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('relay', {
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
  },
});
