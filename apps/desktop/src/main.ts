import { app, BrowserWindow } from 'electron';

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.loadURL('data:text/html,<h1>FB Autopost Desktop — boot OK</h1>');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
