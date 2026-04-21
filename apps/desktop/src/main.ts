import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { getDesktopPaths, toDatabaseUrl } from './paths';
import { findFreePort } from './port';
import { buildEnv, spawnWeb, spawnWorker, waitForHttp, killAll, Sidecar } from './sidecars';
import { runMigrations } from './migrate';

// Dev: repo root is 3 dirs above apps/desktop/dist/main.js.
// Packaged builds will override repoRoot in a later task.
const repoRoot = path.resolve(__dirname, '..', '..', '..');

let sidecars: Sidecar[] = [];

async function boot(): Promise<void> {
  const paths = getDesktopPaths();
  const databaseUrl = toDatabaseUrl(paths.dbPath);
  await runMigrations({ repoRoot, databaseUrl });
  const webPort = await findFreePort();
  const env = buildEnv({
    appDataDir: paths.appDataDir,
    databaseUrl,
    uploadRoot: paths.uploadRoot,
    sessionRoot: paths.sessionRoot,
    logDir: paths.logDir,
    webPort,
  });

  const web = spawnWeb(repoRoot, env);
  const worker = spawnWorker(repoRoot, env);
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

  // Security: deny in-window navigation away from the app origin,
  // and route any "open in new window" attempts to the system browser.
  const allowedOrigin = `http://127.0.0.1:${webPort}`;
  win.webContents.on('will-navigate', (e, target) => {
    if (!target.startsWith(allowedOrigin)) e.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url: openUrl }) => {
    shell.openExternal(openUrl).catch(() => undefined);
    return { action: 'deny' };
  });

  await win.loadURL(url);
}

app.whenReady().then(boot).catch((err) => {
  console.error('boot failed', err);
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
