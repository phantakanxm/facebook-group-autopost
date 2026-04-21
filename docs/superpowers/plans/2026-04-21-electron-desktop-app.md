# Electron Desktop App + Auto-Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the existing Next.js + worker monorepo into a distributable Electron desktop app that end users install once and updates automatically via GitHub Releases.

**Architecture:** A new `apps/desktop` Electron app is the installer/shell. On launch, the Electron main process resolves a per-user data directory (`app.getPath('userData')`), runs Prisma migrations there, then spawns two Node.js sidecars — `next start` (Next.js standalone) and the worker (`node dist/main.js`) — on random free ports, both inheriting environment variables that point every path (DB, uploads, sessions, logs) into the user data directory. The single `BrowserWindow` loads the local web URL. `electron-updater` polls GitHub Releases and auto-installs new versions; GitHub Actions builds and publishes installers per tag.

**Tech Stack:** Electron 32, electron-builder 25, electron-updater 6, Next.js 15 standalone output, Playwright 1.48 (bundled browsers via `extraResources`), Prisma 5 (runtime `migrate deploy`), GitHub Actions matrix (macos-latest / windows-latest / ubuntu-latest).

---

## Phased Overview

| Phase | Output | Shippable? |
|-------|--------|-----------|
| **1. Path refactor** | All hardcoded paths read from env vars with safe fallbacks | ✅ (dev still works unchanged) |
| **2. Electron shell (dev)** | `pnpm -F desktop dev` opens a window that shows the app, sidecars running | ❌ (dev-only) |
| **3. Packaging** | `pnpm -F desktop pack` produces a working `.dmg/.exe/.AppImage` | ✅ (beta ship) |
| **4. Auto-update + CI** | `git tag v0.1.0 && git push --tags` auto-releases installers | ✅ (prod ship) |

Each phase ends in a shippable (or at least locally verifiable) state. Do not skip ahead — later phases assume earlier phases complete.

---

## File Structure

### New files

```
apps/desktop/
├── package.json                     # Electron deps, scripts
├── tsconfig.json                    # TS config for main/preload
├── electron-builder.yml             # Packaging + auto-update config
├── src/
│   ├── main.ts                      # Electron main entry — window + lifecycle
│   ├── paths.ts                     # Resolve userData subdirs, ensure they exist
│   ├── port.ts                      # Find free port (0 → OS picks)
│   ├── sidecars.ts                  # Spawn next + worker, handle crash/restart
│   ├── migrate.ts                   # Run `prisma migrate deploy` before sidecars
│   ├── updater.ts                   # electron-updater wiring
│   └── logger.ts                    # Electron-side logging to userData/logs
└── assets/
    ├── icon.icns                    # Mac icon (placeholder; can be generated later)
    ├── icon.ico                     # Windows icon
    └── icon.png                     # Linux icon (512x512)

packages/shared/src/paths.ts         # (new) single source of truth for path env-var names

.github/workflows/release.yml        # Tag-triggered build+release matrix
```

### Modified files

```
apps/web/next.config.ts              # Add `output: 'standalone'`
apps/web/lib/files.ts:5              # UPLOAD_ROOT from env var
apps/worker/src/playwright/browser.ts:18,37  # sessions path from env var
apps/worker/src/playwright/post.ts:24        # screenshot dir from env var
apps/worker/src/playwright/post-listing.ts:32 # screenshot dir from env var
apps/worker/src/logger.ts:5          # LOG_DIR from env var
packages/db/prisma/schema.prisma     # DATABASE_URL already env-driven (no change)
package.json                         # Add desktop to dev/build scripts
pnpm-workspace.yaml                  # (already includes apps/*)
README.md                            # Desktop dev + release instructions
```

---

## Environment Variable Contract

All code reads these env vars. Electron main sets them before spawning sidecars. Without Electron (i.e. `pnpm dev`), fallbacks keep current behavior so nothing breaks.

| Env var | Purpose | Dev fallback |
|---|---|---|
| `APP_DATA_DIR` | Root for all mutable user data | `<repoRoot>` |
| `DATABASE_URL` | Prisma SQLite path | `file:../../data.db` (from `.env`) |
| `UPLOAD_ROOT` | Uploaded media dir | `<repoRoot>/uploads` |
| `SESSION_ROOT` | Playwright persistent-context dir | `<workerCwd>/sessions` |
| `LOG_DIR` | Pino log output dir | `<workerCwd>/logs` |
| `WEB_PORT` | Port Next.js listens on | `3100` |

`APP_DATA_DIR` is the parent; the rest default to subfolders of it when `APP_DATA_DIR` is set and an individual override is not. Implementation lives in `packages/shared/src/paths.ts`.

---

# PHASE 1 — Path refactor (foundational)

Goal: stop hardcoding `process.cwd()` / relative paths so the same code runs unchanged from CLI and from Electron.

### Task 1.1: Add shared path resolver

**Files:**
- Create: `packages/shared/src/paths.ts`
- Create: `packages/shared/src/paths.test.ts`
- Modify: `packages/shared/src/index.ts` (add export)

- [ ] **Step 1: Write failing test**

```ts
// packages/shared/src/paths.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveAppPaths } from './paths.js';

const keys = ['APP_DATA_DIR', 'UPLOAD_ROOT', 'SESSION_ROOT', 'LOG_DIR'] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  keys.forEach((k) => delete process.env[k]);
});
afterEach(() => {
  keys.forEach((k) => {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  });
});

describe('resolveAppPaths', () => {
  it('returns repo-root fallbacks when APP_DATA_DIR is unset', () => {
    const p = resolveAppPaths({ repoRoot: '/repo' });
    expect(p.uploadRoot).toBe('/repo/uploads');
    expect(p.sessionRoot).toBe('/repo/sessions');
    expect(p.logDir).toBe('/repo/logs');
    expect(p.appDataDir).toBe('/repo');
  });

  it('derives subdirs from APP_DATA_DIR when set', () => {
    process.env.APP_DATA_DIR = '/home/user/.local/share/fbap';
    const p = resolveAppPaths({ repoRoot: '/repo' });
    expect(p.appDataDir).toBe('/home/user/.local/share/fbap');
    expect(p.uploadRoot).toBe('/home/user/.local/share/fbap/uploads');
    expect(p.sessionRoot).toBe('/home/user/.local/share/fbap/sessions');
    expect(p.logDir).toBe('/home/user/.local/share/fbap/logs');
  });

  it('individual overrides beat APP_DATA_DIR', () => {
    process.env.APP_DATA_DIR = '/data';
    process.env.UPLOAD_ROOT = '/custom/uploads';
    const p = resolveAppPaths({ repoRoot: '/repo' });
    expect(p.uploadRoot).toBe('/custom/uploads');
    expect(p.sessionRoot).toBe('/data/sessions');
  });
});
```

- [ ] **Step 2: Run to confirm fail**

Run: `pnpm -F @app/shared test paths`
Expected: FAIL — `resolveAppPaths` not found

- [ ] **Step 3: Implement**

```ts
// packages/shared/src/paths.ts
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
```

- [ ] **Step 4: Export from package**

Modify `packages/shared/src/index.ts`:

```ts
export * from './paths.js';
```

- [ ] **Step 5: Run tests — expect pass**

Run: `pnpm -F @app/shared test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/paths.ts packages/shared/src/paths.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): add resolveAppPaths — env-driven app data paths"
```

---

### Task 1.2: Switch worker to env-driven paths

**Files:**
- Modify: `apps/worker/src/playwright/browser.ts:18,37`
- Modify: `apps/worker/src/playwright/post.ts:24`
- Modify: `apps/worker/src/playwright/post-listing.ts:32`
- Modify: `apps/worker/src/logger.ts:5`

- [ ] **Step 1: Add path helper for worker**

Create `apps/worker/src/paths.ts`:

```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveAppPaths } from '@app/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

export const paths = resolveAppPaths({ repoRoot });
```

- [ ] **Step 2: Replace hardcoded paths**

Modify `apps/worker/src/playwright/browser.ts` — replace both `resolve(process.cwd(), 'sessions', ...)` calls:

```ts
import { paths } from '../paths.js';
// line 18:
const sessionDir = path.join(paths.sessionRoot, opts.userId);
// line 37 (getSessionDir):
return path.join(paths.sessionRoot, userId);
```

Modify `apps/worker/src/playwright/post.ts:24` and `apps/worker/src/playwright/post-listing.ts:32`:

```ts
import { paths } from '../paths.js';
const dir = path.join(paths.logDir, 'screenshots');
```

Modify `apps/worker/src/logger.ts:5`:

```ts
import { paths } from './paths.js';
const LOG_DIR = paths.logDir;
```

- [ ] **Step 3: Verify worker still runs in dev**

Run: `pnpm -F worker dev` (in one terminal, with `.env` present)
Expected: scheduler polling logs appear; `sessions/default-user` and `logs/` created under repo root (fallback behavior unchanged).

Stop with Ctrl+C.

- [ ] **Step 4: Typecheck**

Run: `pnpm -F worker typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/paths.ts apps/worker/src/playwright/browser.ts apps/worker/src/playwright/post.ts apps/worker/src/playwright/post-listing.ts apps/worker/src/logger.ts
git commit -m "refactor(worker): read sessions/logs/screenshots from env-driven paths"
```

---

### Task 1.3: Switch web to env-driven upload path

**Files:**
- Modify: `apps/web/lib/files.ts:5`

- [ ] **Step 1: Replace UPLOAD_ROOT**

```ts
// apps/web/lib/files.ts
import path from 'node:path';
import { resolveAppPaths } from '@app/shared';

const repoRoot = path.resolve(process.cwd(), '..', '..');
const { uploadRoot } = resolveAppPaths({ repoRoot });

export const UPLOAD_ROOT = uploadRoot;
```

- [ ] **Step 2: Verify upload path in dev**

Run: `pnpm -F web dev`
Open `http://localhost:3100`, upload a file on campaign create page, confirm it lands in `<repoRoot>/uploads/` (fallback unchanged).

- [ ] **Step 3: Typecheck**

Run: `pnpm -F web typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/files.ts
git commit -m "refactor(web): read UPLOAD_ROOT from env-driven paths"
```

---

# PHASE 2 — Electron shell (dev mode)

Goal: `pnpm -F desktop dev` opens a native window showing the working app.

### Task 2.1: Bootstrap `apps/desktop` package

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/tsconfig.json`
- Create: `apps/desktop/src/main.ts` (minimal)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "desktop",
  "version": "0.1.0",
  "private": true,
  "main": "dist/main.js",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json && electron dist/main.js",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@app/shared": "workspace:*",
    "electron-updater": "^6.3.9"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "electron": "^32.0.0",
    "electron-builder": "^25.1.8",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

> **Note:** Electron main uses CommonJS — different from the ESM web/worker packages. This is intentional.

- [ ] **Step 3: Minimal main.ts (smoke test only)**

```ts
// apps/desktop/src/main.ts
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
```

- [ ] **Step 4: Install dependencies**

Run: `pnpm install`
Expected: installs Electron (~200MB download first time).

- [ ] **Step 5: Smoke test**

Run: `pnpm -F desktop dev`
Expected: Electron window opens showing "FB Autopost Desktop — boot OK".
Close window to exit.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/package.json apps/desktop/tsconfig.json apps/desktop/src/main.ts pnpm-lock.yaml
git commit -m "feat(desktop): scaffold Electron app with smoke-test window"
```

---

### Task 2.2: Add free-port finder

**Files:**
- Create: `apps/desktop/src/port.ts`
- Create: `apps/desktop/src/port.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/desktop/src/port.test.ts
import { describe, it, expect } from 'vitest';
import { findFreePort } from './port';

describe('findFreePort', () => {
  it('returns a port number in the ephemeral range', async () => {
    const port = await findFreePort();
    expect(port).toBeGreaterThanOrEqual(1024);
    expect(port).toBeLessThan(65536);
  });

  it('returns distinct ports across calls', async () => {
    const [a, b] = await Promise.all([findFreePort(), findFreePort()]);
    expect(a).not.toBe(b);
  });
});
```

> **Note:** `apps/desktop` uses CJS — need to add Vitest for this. Add to devDependencies: `"vitest": "^2.1.0"` and a `"test": "vitest run"` script. Run `pnpm install` after.

- [ ] **Step 2: Run to confirm fail**

Run: `pnpm -F desktop test`
Expected: FAIL — module `./port` not found.

- [ ] **Step 3: Implement**

```ts
// apps/desktop/src/port.ts
import net from 'node:net';

export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (typeof addr === 'object' && addr) {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        reject(new Error('no address'));
      }
    });
  });
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `pnpm -F desktop test`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/port.ts apps/desktop/src/port.test.ts apps/desktop/package.json pnpm-lock.yaml
git commit -m "feat(desktop): add free-port finder"
```

---

### Task 2.3: Add app-paths resolver (Electron side)

**Files:**
- Create: `apps/desktop/src/paths.ts`

- [ ] **Step 1: Implement**

```ts
// apps/desktop/src/paths.ts
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
```

> **Note:** No test for this file — uses Electron's `app` object which requires the Electron runtime. Exercised via manual smoke test in later tasks.

- [ ] **Step 2: Typecheck**

Run: `pnpm -F desktop typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/paths.ts
git commit -m "feat(desktop): resolve per-user data paths under app.getPath('userData')"
```

---

### Task 2.4: Spawn web + worker sidecars

**Files:**
- Create: `apps/desktop/src/sidecars.ts`
- Modify: `apps/desktop/src/main.ts`

- [ ] **Step 1: Implement sidecar spawner**

```ts
// apps/desktop/src/sidecars.ts
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
  // In dev: uses apps/web/.next in-place. In prod: standalone server.js (wired in Phase 3).
  const cwd = path.join(repoRoot, 'apps/web');
  const proc = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', env.PORT!], {
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
```

- [ ] **Step 2: Wire sidecars into main.ts**

```ts
// apps/desktop/src/main.ts
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { getDesktopPaths, toDatabaseUrl } from './paths';
import { findFreePort } from './port';
import { buildEnv, spawnWeb, spawnWorker, waitForHttp, killAll, Sidecar } from './sidecars';

// In dev the repo root is 3 levels up from apps/desktop/dist/main.js.
// In prod we override via `PACKAGED_REPO_ROOT` (set in Phase 3).
const repoRoot = process.env.PACKAGED_REPO_ROOT
  ? process.env.PACKAGED_REPO_ROOT
  : path.resolve(__dirname, '..', '..', '..');

let sidecars: Sidecar[] = [];

async function boot() {
  const paths = getDesktopPaths();
  const webPort = await findFreePort();
  const env = buildEnv({
    appDataDir: paths.appDataDir,
    databaseUrl: toDatabaseUrl(paths.dbPath),
    uploadRoot: paths.uploadRoot,
    sessionRoot: paths.sessionRoot,
    logDir: paths.logDir,
    webPort,
  });

  // Web FIRST — worker can start in parallel but window waits on web.
  const web = spawnWeb(repoRoot, env);
  const worker = spawnWorker(repoRoot, env);
  sidecars = [web, worker];

  await waitForHttp(`http://127.0.0.1:${webPort}/`);

  const win = new BrowserWindow({
    width: 1280, height: 800,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  await win.loadURL(`http://127.0.0.1:${webPort}/`);
}

app.whenReady().then(boot).catch((err) => {
  console.error('boot failed', err);
  app.quit();
});

app.on('window-all-closed', async () => {
  await killAll(sidecars);
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async (e) => {
  if (sidecars.length === 0) return;
  e.preventDefault();
  const toKill = sidecars;
  sidecars = [];
  await killAll(toKill);
  app.quit();
});
```

- [ ] **Step 3: Pre-build web and worker for the smoke test**

Run:
```bash
pnpm -F web build
pnpm -F worker build
```
Expected: both succeed. `apps/web/.next/` and `apps/worker/dist/` populated.

- [ ] **Step 4: Smoke test full boot**

Run: `pnpm -F desktop dev`
Expected:
- Window opens showing the dashboard after a few seconds.
- Terminal shows `[web] ✓ Ready in ...` and `[worker] worker starting`.
- Open macOS `~/Library/Application Support/desktop/` (or equivalent on the platform) — should contain empty `uploads/`, `sessions/`, `logs/` dirs and no `app.db` yet (migrations come in next task).

> **Expected failure:** web server starts and serves but any tRPC call will fail because `app.db` doesn't exist. That's fine for this task — the window loads, which proves plumbing works.

Close the window; verify sidecars exit (no stale `next` / `node` processes in Activity Monitor).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/sidecars.ts apps/desktop/src/main.ts
git commit -m "feat(desktop): spawn next + worker sidecars and load window on ready"
```

---

### Task 2.5: Run Prisma migrations on first launch

**Files:**
- Create: `apps/desktop/src/migrate.ts`
- Modify: `apps/desktop/src/main.ts`
- Modify: `apps/desktop/package.json` (add dependency on db package)

- [ ] **Step 1: Add db dependency**

Modify `apps/desktop/package.json` dependencies:

```json
"@app/db": "workspace:*",
```

Run: `pnpm install`

- [ ] **Step 2: Implement migrate runner**

```ts
// apps/desktop/src/migrate.ts
import { spawn } from 'node:child_process';
import path from 'node:path';

export function runMigrations(opts: {
  repoRoot: string;
  databaseUrl: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const cwd = path.join(opts.repoRoot, 'packages/db');
    const proc = spawn(
      process.execPath,
      ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      {
        cwd,
        env: { ...process.env, DATABASE_URL: opts.databaseUrl },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    proc.stdout?.on('data', (d) => process.stdout.write(`[migrate] ${d}`));
    proc.stderr?.on('data', (d) => process.stderr.write(`[migrate] ${d}`));
    proc.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`prisma migrate deploy exited ${code}`)));
    proc.on('error', reject);
  });
}
```

- [ ] **Step 3: Wire into boot before spawning sidecars**

In `apps/desktop/src/main.ts`, add inside `boot()` after `getDesktopPaths()`:

```ts
import { runMigrations } from './migrate';
// ...
const paths = getDesktopPaths();
const databaseUrl = toDatabaseUrl(paths.dbPath);
await runMigrations({ repoRoot, databaseUrl });
const webPort = await findFreePort();
const env = buildEnv({
  appDataDir: paths.appDataDir,
  databaseUrl,
  // ...
```

- [ ] **Step 4: Smoke test with empty data dir**

Wipe Electron userData first:
```bash
rm -rf "$HOME/Library/Application Support/desktop"
```

Run: `pnpm -F desktop dev`

Expected:
- `[migrate] All migrations have been successfully applied.` in terminal
- `app.db` now exists in the userData dir
- App dashboard loads and tRPC calls work (session banner appears, etc.)

- [ ] **Step 5: Second run (idempotent)**

Run: `pnpm -F desktop dev` again
Expected: `[migrate] No pending migrations to apply.` — boot completes quickly.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/migrate.ts apps/desktop/src/main.ts apps/desktop/package.json pnpm-lock.yaml
git commit -m "feat(desktop): run prisma migrate deploy on boot before spawning sidecars"
```

---

# PHASE 3 — Packaging

Goal: produce a `.dmg` / `.exe` / `.AppImage` that a non-developer can double-click and use.

### Task 3.1: Enable Next.js standalone output

**Files:**
- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: Add standalone mode**

```ts
import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config: NextConfig = {
  output: 'standalone',
  // CRITICAL for pnpm monorepo: tells Next's file tracer to look at the
  // repo root so it follows symlinks into packages/db, packages/shared,
  // and their transitive deps (@prisma/client, playwright, etc.).
  // Without this, the standalone build silently omits monorepo packages.
  outputFileTracingRoot: path.join(__dirname, '..', '..'),
  reactStrictMode: true,
  transpilePackages: ['@app/db', '@app/shared'],
  experimental: { serverActions: { bodySizeLimit: '600mb' } },
  webpack(webpackConfig) {
    webpackConfig.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'] };
    return webpackConfig;
  },
};
export default config;
```

- [ ] **Step 2: Build and verify layout**

Run: `pnpm -F web build`

Expected output structure:
```
apps/web/.next/standalone/
├── apps/web/server.js
├── apps/web/.next/
├── node_modules/
└── package.json
```

The standalone `server.js` is a self-contained Node script that doesn't need `next` on PATH.

- [ ] **Step 3: Verify standalone runs**

Run:
```bash
DATABASE_URL="file:$PWD/data.db" APP_DATA_DIR="$PWD" node apps/web/.next/standalone/apps/web/server.js
```
Expected: server listens (default port 3000). Ctrl+C to stop.

- [ ] **Step 4: Commit**

```bash
git add apps/web/next.config.ts
git commit -m "build(web): enable Next.js standalone output for desktop packaging"
```

---

### Task 3.2: Switch sidecar to standalone server.js in packaged mode

**Files:**
- Modify: `apps/desktop/src/sidecars.ts` (`spawnWeb`)

> **Note:** The packaged path used here (`apps/web/.next/standalone/apps/web/server.js`) is relative to the dev repo root. Task 3.4 will introduce an `extraResources` layout where the packaged build lives under `<resources>/app-web/...` and the path is rewritten accordingly. This task only validates the dev branch still works; don't try to run `pack` yet.

- [ ] **Step 1: Detect packaged vs dev**

Update `spawnWeb` to accept a flag:

```ts
export function spawnWeb(
  repoRoot: string,
  env: NodeJS.ProcessEnv,
  opts: { packaged: boolean }
): Sidecar {
  const script = opts.packaged
    ? path.join(repoRoot, 'apps/web/.next/standalone/apps/web/server.js')
    : path.join(repoRoot, 'apps/web/node_modules/next/dist/bin/next');
  const args = opts.packaged ? [script] : [script, 'start', '-p', env.PORT!];
  const cwd = opts.packaged
    ? path.join(repoRoot, 'apps/web/.next/standalone/apps/web')
    : path.join(repoRoot, 'apps/web');
  const proc = spawn(process.execPath, args, {
    cwd, env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stdout?.on('data', (d) => process.stdout.write(`[web] ${d}`));
  proc.stderr?.on('data', (d) => process.stderr.write(`[web] ${d}`));
  return { name: 'web', proc };
}
```

- [ ] **Step 2: Pass `packaged` from main**

In `apps/desktop/src/main.ts`:

```ts
const packaged = app.isPackaged;
// ...
const web = spawnWeb(repoRoot, env, { packaged });
const worker = spawnWorker(repoRoot, env);
```

> **Note:** `app.isPackaged` is true when running from a built installer, false under `electron .` or `pnpm -F desktop dev`.

- [ ] **Step 3: Dev still works**

Run: `pnpm -F desktop dev`
Expected: boots as before (uses `next start`).

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/sidecars.ts apps/desktop/src/main.ts
git commit -m "feat(desktop): spawn standalone server.js when packaged, next start in dev"
```

---

### Task 3.3: Bundle static assets into standalone

Next.js standalone does **not** include `.next/static` or `public/` — they must be copied. Handle it in the build script.

**Files:**
- Modify: `apps/web/package.json` (postbuild script)

- [ ] **Step 1: Add postbuild script**

```json
"scripts": {
  "dev": "dotenv -e ../../.env -- next dev -p 3100",
  "build": "dotenv -e ../../.env -- next build",
  "postbuild": "node -e \"const fs=require('fs'),path=require('path');const S='.next/standalone/apps/web';fs.cpSync('.next/static',path.join(S,'.next/static'),{recursive:true});if(fs.existsSync('public'))fs.cpSync('public',path.join(S,'public'),{recursive:true});\"",
  "start": "dotenv -e ../../.env -- next start -p 3100",
  "typecheck": "tsc --noEmit",
  "test": "vitest run"
}
```

- [ ] **Step 2: Rebuild and verify**

Run: `pnpm -F web build`
Expected: `apps/web/.next/standalone/apps/web/.next/static/` now exists with CSS/JS chunks.

- [ ] **Step 3: Start standalone and browse**

Run:
```bash
DATABASE_URL="file:$PWD/data.db" APP_DATA_DIR="$PWD" node apps/web/.next/standalone/apps/web/server.js
```
Open `http://localhost:3000` — page renders with styles (if styles were broken, standalone failed to copy static assets).

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json
git commit -m "build(web): copy static + public into standalone output"
```

---

### Task 3.4: electron-builder config + first packaged build

**Files:**
- Create: `apps/desktop/electron-builder.yml`
- Create: `apps/desktop/assets/icon.png` (placeholder — 512×512 solid color PNG is fine for now)
- Modify: `apps/desktop/package.json` (add pack/dist scripts)

- [ ] **Step 1: Create placeholder icon**

Any 512×512 PNG works. Quick way:
```bash
cd apps/desktop
mkdir -p assets
# generate a placeholder via Node
node -e "const fs=require('fs');const buf=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQYV2NgAAIAAAUAAarVyFEAAAAASUVORK5CYII=','base64');fs.writeFileSync('assets/icon.png',buf);"
```
(Replace with real icon later.)

- [ ] **Step 2: Create electron-builder.yml**

```yaml
# apps/desktop/electron-builder.yml
appId: com.phantakanxm.fbgroupautopost
productName: FB Group Autopost
directories:
  output: release
  buildResources: assets

files:
  - dist/**/*
  - package.json

extraResources:
  # Packaged app layout under resources/:
  #   resources/app-web/ — Next standalone output
  #   resources/app-worker/ — worker dist + node_modules
  #   resources/app-db/ — prisma schema + migrations + engines
  - from: ../../apps/web/.next/standalone
    to: app-web
    filter: ["**/*"]
  - from: ../../apps/worker/dist
    to: app-worker/dist
    filter: ["**/*"]
  - from: ../../apps/worker/node_modules
    to: app-worker/node_modules
    filter:
      - "**/*"
      - "!**/*.md"
      - "!**/test/**"
      - "!**/tests/**"
  - from: ../../packages/db/prisma
    to: app-db/prisma
  - from: ../../packages/db/node_modules
    to: app-db/node_modules
    filter:
      - "prisma/**/*"
      - "@prisma/**/*"
      - ".prisma/**/*"

mac:
  target:
    - target: dmg
      arch: [x64, arm64]
  category: public.app-category.productivity
  icon: assets/icon.png

win:
  target:
    - target: nsis
      arch: [x64]
  icon: assets/icon.png

linux:
  target:
    - target: AppImage
      arch: [x64]
  category: Network
  icon: assets/icon.png

publish:
  provider: github
  owner: phantakanxm
  repo: facebook-group-autopost
  releaseType: release
```

- [ ] **Step 3: Add packaging scripts**

Modify `apps/desktop/package.json` scripts:

```json
"scripts": {
  "build": "tsc -p tsconfig.json",
  "dev": "tsc -p tsconfig.json && electron dist/main.js",
  "typecheck": "tsc -p tsconfig.json --noEmit",
  "test": "vitest run",
  "pack": "pnpm build && electron-builder --dir",
  "dist": "pnpm build && electron-builder",
  "prepack:all": "pnpm -F web build && pnpm -F worker build && pnpm -F @app/db exec prisma generate"
}
```

- [ ] **Step 4: Teach main.ts where packaged resources live**

Modify `apps/desktop/src/main.ts`:

```ts
import { app } from 'electron';
// ...
const repoRoot = app.isPackaged
  ? path.join(process.resourcesPath)      // resources/ root — children app-web, app-worker, app-db
  : path.resolve(__dirname, '..', '..', '..');
```

And in `sidecars.ts`, let the paths be configurable — update `spawnWeb` and `spawnWorker` to take an explicit base path, and `spawnWeb`'s packaged branch uses `path.join(repoRoot, 'app-web/apps/web/server.js')` with `cwd = path.join(repoRoot, 'app-web/apps/web')`. For `spawnWorker` packaged use `path.join(repoRoot, 'app-worker/dist/main.js')` with `cwd = path.join(repoRoot, 'app-worker')`. Similarly update `migrate.ts` to use `path.join(repoRoot, 'app-db')` in packaged mode.

Concrete patch for `spawnWeb`:

```ts
const script = opts.packaged
  ? path.join(repoRoot, 'app-web/apps/web/server.js')
  : path.join(repoRoot, 'apps/web/node_modules/next/dist/bin/next');
// ...
const cwd = opts.packaged
  ? path.join(repoRoot, 'app-web/apps/web')
  : path.join(repoRoot, 'apps/web');
```

For `spawnWorker` — update the signature to accept `opts: { packaged: boolean }` like `spawnWeb`:

```ts
export function spawnWorker(
  repoRoot: string,
  env: NodeJS.ProcessEnv,
  opts: { packaged: boolean }
): Sidecar {
  const cwd = opts.packaged
    ? path.join(repoRoot, 'app-worker')
    : path.join(repoRoot, 'apps/worker');
  const proc = spawn(process.execPath, ['dist/main.js'], {
    cwd, env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stdout?.on('data', (d) => process.stdout.write(`[worker] ${d}`));
  proc.stderr?.on('data', (d) => process.stderr.write(`[worker] ${d}`));
  return { name: 'worker', proc };
}
```

Then in `main.ts`, update the call site:

```ts
const worker = spawnWorker(repoRoot, env, { packaged });
```

For `runMigrations`:

```ts
const cwd = opts.packaged
  ? path.join(opts.repoRoot, 'app-db')
  : path.join(opts.repoRoot, 'packages/db');
```

- [ ] **Step 5: First packaged build (current host platform only)**

Run:
```bash
pnpm install
pnpm -F desktop prepack:all
pnpm -F desktop pack
```
Expected: `apps/desktop/release/<platform>-unpacked/` contains the app bundle (no installer yet — `--dir` skips that for speed).

- [ ] **Step 6: Launch the unpacked build**

On macOS:
```bash
open apps/desktop/release/mac*/FB\ Group\ Autopost.app
```

Expected: window opens, app works end-to-end. Check macOS Console or terminal for sidecar logs.

> **Troubleshooting:** If Playwright can't find Chromium, the browsers weren't bundled. Fix: extraResources is for compiled data only — Playwright browsers install to `~/Library/Caches/ms-playwright/` by default. Address in next task.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/electron-builder.yml apps/desktop/assets/icon.png apps/desktop/package.json apps/desktop/src/main.ts apps/desktop/src/sidecars.ts apps/desktop/src/migrate.ts
git commit -m "build(desktop): electron-builder config + packaged layout wiring"
```

---

### Task 3.5: Bundle Playwright Chromium

**Files:**
- Modify: `apps/desktop/electron-builder.yml`
- Modify: `apps/desktop/src/main.ts`

- [ ] **Step 1: Lock Playwright browsers path during build**

Before packaging, download Chromium into a repo-local dir so it can be bundled:

```bash
PLAYWRIGHT_BROWSERS_PATH=./apps/worker/ms-playwright pnpm -F worker exec playwright install chromium
```

This writes `apps/worker/ms-playwright/chromium-XXXX/` (~170MB).

Add to `electron-builder.yml` extraResources:

```yaml
  - from: ../../apps/worker/ms-playwright
    to: app-worker/ms-playwright
    filter: ["**/*"]
```

- [ ] **Step 2: Point worker at bundled Chromium**

In `apps/desktop/src/main.ts` boot():

```ts
if (app.isPackaged) {
  env.PLAYWRIGHT_BROWSERS_PATH = path.join(repoRoot, 'app-worker/ms-playwright');
}
```

(Add this before `spawnWorker(...)`.)

- [ ] **Step 3: Repackage and test**

```bash
pnpm -F desktop prepack:all
pnpm -F desktop pack
```
Launch app, go to **Session** page, click **Open browser to log in**.
Expected: Chromium window opens from the bundled path.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/electron-builder.yml apps/desktop/src/main.ts
git commit -m "build(desktop): bundle Playwright Chromium into installer"
```

---

### Task 3.6: Build full installer (DMG / EXE / AppImage)

**Files:** (none — just commands + verification)

- [ ] **Step 1: Build**

```bash
pnpm -F desktop prepack:all
pnpm -F desktop dist
```

Expected: `apps/desktop/release/` now contains a `.dmg` on Mac, `.exe` on Windows, or `.AppImage` on Linux, plus `latest-mac.yml` / `latest.yml` / `latest-linux.yml` (auto-update metadata).

- [ ] **Step 2: Install + run on a clean machine (or VM)**

Double-click the installer. On macOS first launch expect a Gatekeeper warning ("app from unidentified developer") — right-click → Open. Document this in README.

Expected: app runs exactly like the unpacked version from Task 3.4.

> **Checkpoint:** at this point you can ship beta builds manually. Upload the installer to GitHub Releases by hand if you need to test distribution before wiring CI.

---

# PHASE 4 — Auto-update + CI

### Task 4.1: Wire electron-updater

**Files:**
- Create: `apps/desktop/src/updater.ts`
- Modify: `apps/desktop/src/main.ts`

- [ ] **Step 1: Implement updater module**

```ts
// apps/desktop/src/updater.ts
import { autoUpdater } from 'electron-updater';
import { dialog, app, BrowserWindow } from 'electron';

export function initAutoUpdater() {
  if (!app.isPackaged) return;  // never check in dev
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.webContents.send('updater:available', info);
    console.log('[updater] update available', info.version);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    console.log('[updater] downloaded', info.version);
    const res = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      title: 'Update ready',
      message: `Version ${info.version} has been downloaded. Restart to install.`,
    });
    if (res.response === 0) autoUpdater.quitAndInstall();
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater] error', err);
  });

  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.error('[updater] check failed', err);
  });
}
```

- [ ] **Step 2: Call on app ready**

In `apps/desktop/src/main.ts`, at end of `boot()`:

```ts
import { initAutoUpdater } from './updater';
// ...
initAutoUpdater();
```

- [ ] **Step 3: Local smoke test (no real update yet)**

Run: `pnpm -F desktop pack && ./apps/desktop/release/mac-*/FB\ Group\ Autopost.app/Contents/MacOS/FB\ Group\ Autopost`
Expected: console shows `[updater] check failed` with a 404 or similar — because no Release exists yet. That's OK for now.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/updater.ts apps/desktop/src/main.ts
git commit -m "feat(desktop): integrate electron-updater (auto-download, prompt on downloaded)"
```

---

### Task 4.2: GitHub Actions release workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Write workflow**

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Install deps
        run: pnpm install --frozen-lockfile

      - name: Prisma generate
        run: pnpm -F @app/db exec prisma generate

      - name: Build web + worker
        run: |
          pnpm -F web build
          pnpm -F worker build

      - name: Install Playwright Chromium (bundled path)
        shell: bash
        env:
          PLAYWRIGHT_BROWSERS_PATH: ./apps/worker/ms-playwright
        run: pnpm -F worker exec playwright install chromium

      - name: Build + publish Electron app
        working-directory: apps/desktop
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: pnpm exec electron-builder --publish always
```

- [ ] **Step 2: Test locally with a dry tag (no push)**

```bash
git tag v0.0.0-test
# do NOT push — just verify workflow file parses
git tag -d v0.0.0-test
```

- [ ] **Step 3: First real release**

Bump version in `apps/desktop/package.json` to `"version": "0.1.0"`, then:

```bash
git add apps/desktop/package.json
git commit -m "chore: release v0.1.0"
git tag v0.1.0
git push origin main --tags
```

- [ ] **Step 4: Watch the workflow**

Open `https://github.com/phantakanxm/facebook-group-autopost/actions`.
Expected: 3 parallel jobs (Mac/Win/Linux). Each ~8–15 min.
On success, `https://github.com/phantakanxm/facebook-group-autopost/releases/tag/v0.1.0` has:
- `FB Group Autopost-0.1.0.dmg` + `FB Group Autopost-0.1.0-arm64.dmg`
- `FB Group Autopost Setup 0.1.0.exe`
- `FB Group Autopost-0.1.0.AppImage`
- `latest-mac.yml`, `latest.yml`, `latest-linux.yml`

- [ ] **Step 5: Verify auto-update end-to-end**

1. Download and install `v0.1.0` locally.
2. Bump to `0.1.1` in `apps/desktop/package.json`, commit, tag `v0.1.1`, push.
3. Wait for Actions to finish (~15 min).
4. Launch the installed `0.1.0` app → within ~30s it should download `0.1.1` in the background → a restart dialog appears.
5. Click **Restart now** → app relaunches on `0.1.1`.

(Check `~/Library/Logs/FB Group Autopost/` on Mac for updater logs.)

- [ ] **Step 6: No commit** (changes already in release commit).

---

### Task 4.3: Document the release process

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add sections**

Append to `README.md`:

````markdown
## Desktop app (end users)

Download the latest installer for your OS from the [Releases](https://github.com/phantakanxm/facebook-group-autopost/releases) page:

- **macOS:** `.dmg` — on first launch, right-click → **Open** to bypass Gatekeeper (app is not yet code-signed).
- **Windows:** `.exe` — SmartScreen may warn; click **More info → Run anyway**.
- **Linux:** `.AppImage` — `chmod +x` then double-click.

The app auto-updates in the background when a new version is released.

## Desktop development

```bash
pnpm install
pnpm -F web build && pnpm -F worker build   # standalone outputs
pnpm -F desktop dev
```

First boot creates a per-user data dir:
- macOS: `~/Library/Application Support/FB Group Autopost/`
- Windows: `%APPDATA%\FB Group Autopost\`
- Linux: `~/.config/FB Group Autopost/`

Contains `app.db`, `uploads/`, `sessions/`, `logs/`.

## Releasing a new version

```bash
# 1. bump version
vim apps/desktop/package.json         # e.g. 0.1.0 → 0.1.1
git add apps/desktop/package.json
git commit -m "chore: release v0.1.1"

# 2. tag + push
git tag v0.1.1
git push origin main --tags

# 3. wait for CI (~15 min). Release auto-appears at:
#    https://github.com/phantakanxm/facebook-group-autopost/releases
```

Installed apps pick up the update within ~30s of next launch.
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: desktop install, development, and release workflow"
```

---

## Known Limitations (not addressed in this plan)

These are deliberate scope cuts — add if/when users actually need them:

- **No code signing** — users see Gatekeeper / SmartScreen warnings on first install. Apple Developer ID is $99/year; Windows EV cert is ~$300/year. Document in README.
- **No crash reporting** — Electron has `crashReporter` + Sentry integrations; not wired.
- **No in-app update UI** — updates happen silently; dialog appears only when download completes. No "Check for updates" menu item. Add if users report confusion.
- **No Prisma schema downgrade path** — if a user installs v0.2.0 then tries to downgrade to v0.1.0 with an incompatible schema, they'll get errors. Document "don't downgrade" or add a warning on version mismatch.
- **No multi-user UI** — data model supports it but UI still assumes `default-user`.
- **AppImage on Linux is auto-update-capable but may need extra setup** — see electron-updater docs if Linux users hit issues.

---

## Post-launch monitoring

After first release, watch for:
- Failed auto-update events — check GitHub Releases download stats vs expected active users.
- Issues with bundled Chromium on different macOS / Windows versions (Playwright version mismatch).
- `apps/worker/ms-playwright` inflating installer size beyond acceptable (currently ~300MB total; if it creeps to 500MB+, consider downloading browsers on first run instead of bundling).
