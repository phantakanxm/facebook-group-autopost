// Pre-stage worker and db artifacts into a self-contained directory that
// electron-builder can bundle directly via extraResources.
//
// pnpm's default node_modules layout (symlinks into .pnpm/) doesn't survive
// the copy electron-builder does — missing transitive deps, broken .prisma
// engine resolution, etc. We use `pnpm deploy --node-linker=hoisted` to
// produce a flat node_modules with all transitive deps materialized.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopRoot, '..', '..');
const stagedRoot = path.join(desktopRoot, '.staged');

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copy(src, dst, opts = {}) {
  if (!fs.existsSync(src)) {
    console.warn(`[stage] missing source: ${src}`);
    return;
  }
  fs.cpSync(src, dst, { recursive: true, dereference: true, ...opts });
}

function pnpmDeploy(filter, dest) {
  // --node-linker=hoisted = flatten transitive deps to top-level node_modules,
  //                         same shape Node expects without pnpm at runtime.
  // --prod = skip devDependencies.
  execSync(
    `pnpm --filter ${filter} deploy --prod --node-linker=hoisted "${dest}"`,
    { cwd: repoRoot, stdio: 'inherit' }
  );
}

// Resolve .prisma generated-client dir via the @prisma/client symlink. pnpm
// places .prisma next to @prisma/client in the virtual store; we need to copy
// it into the staged node_modules so @prisma/client's default.js can resolve
// require('.prisma/client/default') at runtime.
function resolveDotPrismaSource() {
  const link = path.join(repoRoot, 'packages/db/node_modules/@prisma/client');
  if (!fs.existsSync(link)) return null;
  const real = fs.realpathSync(link);
  const dotPrisma = path.resolve(real, '..', '..', '.prisma');
  return fs.existsSync(dotPrisma) ? dotPrisma : null;
}

console.log(`[stage] cleaning ${path.relative(repoRoot, stagedRoot)}`);
rmrf(stagedRoot);
fs.mkdirSync(stagedRoot, { recursive: true });

const dotPrismaSrc = resolveDotPrismaSource();
if (!dotPrismaSrc) {
  console.warn('[stage] WARNING: .prisma engine not found — both worker and db will crash at runtime');
}

// --- app-worker ---
const appWorkerStaged = path.join(stagedRoot, 'app-worker');
console.log('[stage] pnpm deploy worker → .staged/app-worker');
pnpmDeploy('worker', appWorkerStaged);

// Verify dist came along
if (!fs.existsSync(path.join(appWorkerStaged, 'dist/main.js'))) {
  throw new Error('worker dist/main.js missing after pnpm deploy — run pnpm -F worker build first');
}

// Copy .prisma into worker's top-level node_modules (hoisted resolution)
if (dotPrismaSrc) {
  console.log('[stage] app-worker .prisma engine');
  copy(dotPrismaSrc, path.join(appWorkerStaged, 'node_modules/.prisma'));
}

// ms-playwright (Chromium bundle)
const msPwSrc = path.join(repoRoot, 'apps/worker/ms-playwright');
const msPwDst = path.join(appWorkerStaged, 'ms-playwright');
if (fs.existsSync(msPwSrc)) {
  console.log('[stage] app-worker/ms-playwright');
  copy(msPwSrc, msPwDst, {
    // headless_shell is dead weight (~150MB) — worker runs headed for FB anti-detection
    filter: (src) => !path.basename(src).startsWith('chromium_headless_shell-'),
  });
}

// --- app-db ---
const appDbStaged = path.join(stagedRoot, 'app-db');
console.log('[stage] pnpm deploy @app/db → .staged/app-db');
pnpmDeploy('@app/db', appDbStaged);

// Verify dist (seed.js used by boot-time seed)
if (!fs.existsSync(path.join(appDbStaged, 'dist/seed.js'))) {
  throw new Error('db dist/seed.js missing after pnpm deploy — run pnpm -F @app/db build first');
}

// Copy .prisma into db's top-level node_modules (hoisted resolution)
if (dotPrismaSrc) {
  console.log('[stage] app-db .prisma engine');
  copy(dotPrismaSrc, path.join(appDbStaged, 'node_modules/.prisma'));
}

// pnpm deploy drops the `prisma` CLI from node_modules/.bin when it's a
// devDependency. Our runtime migrate step spawns
// `node node_modules/prisma/build/index.js` — verify the CLI package itself
// was hoisted (it's a peer of @prisma/client).
if (!fs.existsSync(path.join(appDbStaged, 'node_modules/prisma/build/index.js'))) {
  // Fall back: copy prisma CLI explicitly from the pnpm store.
  const prismaCliLink = path.join(repoRoot, 'packages/db/node_modules/prisma');
  if (fs.existsSync(prismaCliLink)) {
    console.log('[stage] app-db prisma CLI (fallback)');
    copy(prismaCliLink, path.join(appDbStaged, 'node_modules/prisma'));
  } else {
    throw new Error('prisma CLI not found — migrate will fail at runtime');
  }
}

// Write minimal package.json override with "type": "module" — Electron's
// run-as-node mode lacks plain-Node 20's auto-detect-and-reparse fallback,
// so ESM-syntax dist/*.js files need an explicit ESM declaration to run.
// pnpm deploy copies the real package.json; we merge in the type field.
for (const dir of [appDbStaged, appWorkerStaged]) {
  const pkgPath = path.join(dir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.type !== 'module') {
    pkg.type = 'module';
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }
}
console.log('[stage] ensured type:module on staged packages');

console.log('[stage] done');
