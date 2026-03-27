import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './window';
import { registerIpcHandlers } from './ipc';
import { TerminalManager } from './terminal';
import { ShellManager } from './shell';

let mainWindow: BrowserWindow | null = null;

app.whenReady().then(() => {
  mainWindow = createMainWindow();
  const terminalManager = new TerminalManager(mainWindow);
  const shellManager = new ShellManager(mainWindow);
  registerIpcHandlers(mainWindow, terminalManager, shellManager);

  app.on('before-quit', () => {
    terminalManager.killAll();
    shellManager.killAll();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
