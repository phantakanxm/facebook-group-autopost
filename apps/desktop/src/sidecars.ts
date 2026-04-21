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
    // process.execPath inside Electron is the Electron binary, not Node.
    // This var tells Electron to run as plain Node when re-spawned via execPath.
    ELECTRON_RUN_AS_NODE: '1',
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

export function spawnWeb(
  webRoot: string,
  env: NodeJS.ProcessEnv,
  _opts: { packaged: boolean }
): Sidecar {
  const cwd = webRoot;
  const script = path.join(cwd, 'server.js');
  const proc = spawn(process.execPath, [script], {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stdout?.on('data', (d) => process.stdout.write(`[web] ${d}`));
  proc.stderr?.on('data', (d) => process.stderr.write(`[web] ${d}`));
  return { name: 'web', proc };
}

export function spawnWorker(
  workerRoot: string,
  env: NodeJS.ProcessEnv,
  _opts: { packaged: boolean }
): Sidecar {
  const cwd = workerRoot;
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
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };
      s.proc.once('exit', finish);
      const timer = setTimeout(() => {
        if (s.proc.exitCode === null) {
          // SIGTERM didn't take — escalate. The 'exit' listener above will
          // fire once SIGKILL actually delivers, then call finish().
          s.proc.kill('SIGKILL');
        }
      }, 3000);
      s.proc.kill('SIGTERM');
    })
  )).then(() => undefined);
}
