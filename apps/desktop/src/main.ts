import { app, BrowserWindow, Notification, dialog, shell } from 'electron';
import path from 'node:path';
import { getDesktopPaths, toDatabaseUrl } from './paths';
import { findFreePort } from './port';
import { buildEnv, spawnWeb, spawnWorker, waitForHttp, killAll, Sidecar } from './sidecars';
import { runMigrations } from './migrate';
import { runSeed } from './seed';
import { initAutoUpdater } from './updater';

// Dev: repo root is 3 dirs above apps/desktop/dist/main.js.
// Packaged: layout is under <Resources>/.
const repoRoot = path.resolve(__dirname, '..', '..', '..');

let sidecars: Sidecar[] = [];

function resolveLayout(packaged: boolean) {
  if (packaged) {
    const r = process.resourcesPath;
    return {
      webRoot: path.join(r, 'app-web/apps/web'),
      workerRoot: path.join(r, 'app-worker'),
      dbRoot: path.join(r, 'app-db'),
    };
  }
  return {
    webRoot: path.join(repoRoot, 'apps/web/.next/standalone/apps/web'),
    workerRoot: path.join(repoRoot, 'apps/worker'),
    dbRoot: path.join(repoRoot, 'packages/db'),
  };
}

async function boot(): Promise<void> {
  const packaged = app.isPackaged;
  const layout = resolveLayout(packaged);
  const paths = getDesktopPaths();
  const databaseUrl = toDatabaseUrl(paths.dbPath);

  await runMigrations({ dbRoot: layout.dbRoot, databaseUrl });
  await runSeed({ dbRoot: layout.dbRoot, databaseUrl });

  const webPort = await findFreePort();
  const env = buildEnv({
    appDataDir: paths.appDataDir,
    databaseUrl,
    uploadRoot: paths.uploadRoot,
    sessionRoot: paths.sessionRoot,
    logDir: paths.logDir,
    webPort,
  });

  if (packaged) {
    env.PLAYWRIGHT_BROWSERS_PATH = path.join(process.resourcesPath, 'app-worker/ms-playwright');
  }

  const web = spawnWeb(layout.webRoot, env, { packaged });
  const worker = spawnWorker(layout.workerRoot, env, {
    packaged,
    onNotify: ({ title, body }) => {
      if (Notification.isSupported()) {
        new Notification({ title, body }).show();
      }
    },
  });
  sidecars = [web, worker];

  const url = `http://127.0.0.1:${webPort}/`;
  await waitForHttp(url);

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const allowedOrigin = `http://127.0.0.1:${webPort}`;
  win.webContents.on('will-navigate', (e, target) => {
    if (!target.startsWith(allowedOrigin)) e.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url: openUrl }) => {
    shell.openExternal(openUrl).catch(() => undefined);
    return { action: 'deny' };
  });

  await win.loadURL(url);
  initAutoUpdater();
}

app.whenReady().then(boot).catch((err) => {
  console.error('boot failed', err);
  const message = err instanceof Error ? err.message : String(err);
  dialog.showErrorBox(
    'FB Group Autopost — startup failed',
    `${message}\n\nCheck logs and try reopening. If this persists, file an issue.`,
  );
  app.quit();
});

app.on('window-all-closed', async () => {
  try {
    await killAll(sidecars);
  } catch (err) {
    console.error('killAll failed on window-all-closed', err);
  } finally {
    sidecars = [];
    if (process.platform !== 'darwin') app.quit();
  }
});

app.on('before-quit', async (e) => {
  if (sidecars.length === 0) return;
  e.preventDefault();
  const toKill = sidecars;
  sidecars = [];
  try {
    await killAll(toKill);
  } catch (err) {
    console.error('killAll failed during quit', err);
  } finally {
    app.quit();
  }
});
