import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import http from 'node:http';

export interface SidecarEnv {
  appDataDir: string;
  databaseUrl: string;
  uploadRoot: string;
  sessionRoot: string;
  logDir: string;
  webPort: number;
}

export interface Sidecar {
  name: string;
  proc: ChildProcess;
}

export function buildEnv(s: SidecarEnv): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: 'production',
    APP_DATA_DIR: s.appDataDir,
    DATABASE_URL: s.databaseUrl,
    UPLOAD_ROOT: s.uploadRoot,
    SESSION_ROOT: s.sessionRoot,
    LOG_DIR: s.logDir,
    PORT: String(s.webPort),
    WEB_PORT: String(s.webPort),
    HOSTNAME: '127.0.0.1',
  };
}

export function spawnWeb(repoRoot: string, env: NodeJS.ProcessEnv): Sidecar {
  // Dev branch only here. Packaged-mode wiring lives in a later task.
  const cwd = path.join(repoRoot, 'apps/web');
  const nextBin = path.join(cwd, 'node_modules/next/dist/bin/next');
  const proc = spawn(process.execPath, [nextBin, 'start', '-p', env.PORT!], {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stdout?.on('data', (d) => process.stdout.write(`[web] ${d}`));
  proc.stderr?.on('data', (d) => process.stderr.write(`[web] ${d}`));
  return { name: 'web', proc };
}

export function spawnWorker(repoRoot: string, env: NodeJS.ProcessEnv): Sidecar {
  const cwd = path.join(repoRoot, 'apps/worker');
  const proc = spawn(process.execPath, ['dist/main.js'], {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stdout?.on('data', (d) => process.stdout.write(`[worker] ${d}`));
  proc.stderr?.on('data', (d) => process.stderr.write(`[worker] ${d}`));
  return { name: 'worker', proc };
}

export async function waitForHttp(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await new Promise<boolean>((resolve) => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve((res.statusCode ?? 500) < 500);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(1000, () => { req.destroy(); resolve(false); });
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`timeout waiting for ${url}`);
}

export function killAll(sidecars: Sidecar[]): Promise<void> {
  return Promise.all(sidecars.map((s) =>
    new Promise<void>((resolve) => {
      if (s.proc.killed || s.proc.exitCode !== null) return resolve();
      s.proc.once('exit', () => resolve());
      s.proc.kill('SIGTERM');
      setTimeout(() => { if (!s.proc.killed) s.proc.kill('SIGKILL'); resolve(); }, 3000);
    })
  )).then(() => undefined);
}
