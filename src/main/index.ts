import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './window';
import { registerIpcHandlers } from './ipc';
import { ClaudeManager } from './claude';
import { ShellManager } from './shell';

let mainWindow: BrowserWindow | null = null;

app.whenReady().then(() => {
  mainWindow = createMainWindow();
  const claudeManager = new ClaudeManager(mainWindow);
  const shellManager = new ShellManager(mainWindow);
  registerIpcHandlers(mainWindow, claudeManager, shellManager);

  app.on('before-quit', () => {
    claudeManager.killAll();
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
