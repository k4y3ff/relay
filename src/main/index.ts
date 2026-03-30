import { app, BrowserWindow, Menu, MenuItem } from 'electron';
import { createMainWindow } from './window';
import { registerIpcHandlers, updateDockIcon } from './ipc';
import { TerminalManager } from './terminal';
import { ShellManager } from './shell';
import { migrateStore, store } from './store';

let mainWindow: BrowserWindow | null = null;

function buildAppMenu(win: BrowserWindow): void {
  const menu = new Menu();

  // App menu (macOS app name)
  const appMenu = new MenuItem({
    label: app.name,
    submenu: [
      new MenuItem({ role: 'about' }),
      new MenuItem({ type: 'separator' }),
      new MenuItem({
        label: 'Settings…',
        accelerator: 'CmdOrCtrl+,',
        click: () => {
          if (!win.isDestroyed()) win.webContents.send('open:settings');
        },
      }),
      new MenuItem({
        label: 'Show Changes',
        accelerator: 'CmdOrCtrl+Shift+C',
        click: () => {
          if (!win.isDestroyed()) win.webContents.send('focus:changes-tab');
        },
      }),
      new MenuItem({
        label: 'Show All Files',
        accelerator: 'CmdOrCtrl+Shift+F',
        click: () => {
          if (!win.isDestroyed()) win.webContents.send('focus:all-files');
        },
      }),
      new MenuItem({
        label: 'Focus Terminal',
        accelerator: 'CmdOrCtrl+Shift+T',
        click: () => {
          if (!win.isDestroyed()) win.webContents.send('focus:terminal');
        },
      }),
      new MenuItem({ type: 'separator' }),
      new MenuItem({ role: 'quit' }),
    ],
  });

  // Edit menu — needed for clipboard shortcuts in inputs
  const editMenu = new MenuItem({
    label: 'Edit',
    submenu: [
      new MenuItem({ role: 'undo' }),
      new MenuItem({ role: 'redo' }),
      new MenuItem({ type: 'separator' }),
      new MenuItem({ role: 'cut' }),
      new MenuItem({ role: 'copy' }),
      new MenuItem({ role: 'paste' }),
      new MenuItem({ role: 'selectAll' }),
    ],
  });

  menu.append(appMenu);
  menu.append(editMenu);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  migrateStore();
  updateDockIcon(store.get('appTheme') as string);
  mainWindow = createMainWindow();
  buildAppMenu(mainWindow);
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
