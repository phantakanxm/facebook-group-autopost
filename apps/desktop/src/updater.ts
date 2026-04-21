import { autoUpdater } from 'electron-updater';
import { app, dialog } from 'electron';

export function initAutoUpdater(): void {
  // Never check for updates in dev — there's no Release to check against,
  // and electron-updater just spams the console with errors.
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] checking for update');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] update available', info.version);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] no update available');
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[updater] downloading ${progress.percent.toFixed(1)}%`);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    console.log('[updater] downloaded', info.version);
    const res = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update ready',
      message: `Version ${info.version} is downloaded.`,
      detail: 'Restart FB Group Autopost to install. Your scheduled campaigns and data are preserved.',
    });
    if (res.response === 0) {
      // quitAndInstall(isSilent, isForceRunAfter)
      autoUpdater.quitAndInstall(false, true);
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater] error', err);
  });

  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.error('[updater] check failed', err);
  });
}
