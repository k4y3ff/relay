import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('relay', {
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
  },
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => listener(...args));
  },
  off: (channel: string, listener: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, listener as never);
  },
});

declare global {
  interface Window {
    relay: {
      versions: { node: string; electron: string };
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      on: (channel: string, listener: (...args: unknown[]) => void) => void;
      off: (channel: string, listener: (...args: unknown[]) => void) => void;
    };
  }
}
