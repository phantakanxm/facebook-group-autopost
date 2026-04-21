import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export interface DesktopPaths {
  appDataDir: string;
  dbPath: string;
  uploadRoot: string;
  sessionRoot: string;
  logDir: string;
}

export function getDesktopPaths(): DesktopPaths {
  const appDataDir = app.getPath('userData');
  const dbPath = path.join(appDataDir, 'app.db');
  const uploadRoot = path.join(appDataDir, 'uploads');
  const sessionRoot = path.join(appDataDir, 'sessions');
  const logDir = path.join(appDataDir, 'logs');

  for (const dir of [appDataDir, uploadRoot, sessionRoot, logDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return { appDataDir, dbPath, uploadRoot, sessionRoot, logDir };
}

export function toDatabaseUrl(dbPath: string): string {
  return `file:${dbPath}`;
}
