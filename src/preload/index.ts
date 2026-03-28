import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('relay', {
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
  },
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    const wrapper = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => listener(...args);
    ipcRenderer.on(channel, wrapper);
    return () => ipcRenderer.removeListener(channel, wrapper);
  },
});

declare global {
  interface Window {
    relay: {
      versions: { node: string; electron: string };
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      on: (channel: string, listener: (...args: unknown[]) => void) => () => void;
    };
  }
}
