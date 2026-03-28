import { BrowserWindow } from 'electron';
import path from 'node:path';

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,

    // macOS: traffic lights inset into app chrome
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },

    // Transparent window for vibrancy + rounded corners
    transparent: true,
    backgroundColor: '#00000000',
    roundedCorners: true,

    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Apply macOS vibrancy to the full window background
  win.setVibrancy('under-window-background');

  // electron-vite sets ELECTRON_RENDERER_URL in dev mode
  const devServerUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devServerUrl) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return win;
}
