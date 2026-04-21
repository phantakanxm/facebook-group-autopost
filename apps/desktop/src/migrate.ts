import { spawn } from 'node:child_process';
import path from 'node:path';

export interface MigrateOpts {
  repoRoot: string;
  databaseUrl: string;
}

export function runMigrations(opts: MigrateOpts): Promise<void> {
  return new Promise((resolve, reject) => {
    const cwd = path.join(opts.repoRoot, 'packages/db');
    const prismaBin = path.join(cwd, 'node_modules/prisma/build/index.js');
    const proc = spawn(
      process.execPath,
      [prismaBin, 'migrate', 'deploy'],
      {
        cwd,
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          DATABASE_URL: opts.databaseUrl,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    proc.stdout?.on('data', (d) => process.stdout.write(`[migrate] ${d}`));
    proc.stderr?.on('data', (d) => process.stderr.write(`[migrate] ${d}`));
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`prisma migrate deploy exited ${code}`));
    });
  });
}
