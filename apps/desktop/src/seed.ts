import { spawn } from 'node:child_process';
import path from 'node:path';

export interface SeedOpts {
  dbRoot: string;
  databaseUrl: string;
}

export function runSeed(opts: SeedOpts): Promise<void> {
  return new Promise((resolve, reject) => {
    const cwd = opts.dbRoot;
    const seedScript = path.join(cwd, 'dist/seed.js');
    const proc = spawn(
      process.execPath,
      [seedScript],
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
    proc.stdout?.on('data', (d) => process.stdout.write(`[seed] ${d}`));
    proc.stderr?.on('data', (d) => process.stderr.write(`[seed] ${d}`));
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`seed exited ${code}`));
    });
  });
}
