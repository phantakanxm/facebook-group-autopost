import path from 'node:path';

export interface AppPaths {
  appDataDir: string;
  uploadRoot: string;
  sessionRoot: string;
  logDir: string;
}

export function resolveAppPaths(opts: { repoRoot: string }): AppPaths {
  const appDataDir = process.env.APP_DATA_DIR ?? opts.repoRoot;
  const uploadRoot = process.env.UPLOAD_ROOT ?? path.join(appDataDir, 'uploads');
  const sessionRoot = process.env.SESSION_ROOT ?? path.join(appDataDir, 'sessions');
  const logDir = process.env.LOG_DIR ?? path.join(appDataDir, 'logs');
  return { appDataDir, uploadRoot, sessionRoot, logDir };
}
