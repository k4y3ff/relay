import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('relay', {
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
  },
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
});

declare global {
  interface Window {
    relay: {
      versions: { node: string; electron: string };
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
    };
  }
}
