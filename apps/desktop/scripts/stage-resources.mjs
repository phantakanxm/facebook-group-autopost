// Pre-stage worker and db artifacts with symlinks dereferenced so
// electron-builder's extraResources copy gets real files, not pnpm
// symlinks that point outside the source dir.
import fs from 'node:fs';
import path from 'node:path';
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

console.log(`[stage] cleaning ${path.relative(repoRoot, stagedRoot)}`);
rmrf(stagedRoot);
fs.mkdirSync(stagedRoot, { recursive: true });

// --- app-db: prisma schema + migrations + dist + needed node_modules ---
const appDbStaged = path.join(stagedRoot, 'app-db');
console.log('[stage] app-db');
copy(path.join(repoRoot, 'packages/db/prisma'), path.join(appDbStaged, 'prisma'));
copy(path.join(repoRoot, 'packages/db/dist'), path.join(appDbStaged, 'dist'));

// node_modules: copy ONLY the dirs Prisma needs, dereferenced.
// pnpm hoists all @prisma/* siblings into node_modules/.pnpm/node_modules/@prisma.
// We need: prisma CLI, all @prisma/* packages (client, engines, debug, etc),
// and the .prisma query-engine generated client.
const dbNodeModulesSrc = path.join(repoRoot, 'packages/db/node_modules');
const dbNodeModulesDst = path.join(appDbStaged, 'node_modules');
fs.mkdirSync(dbNodeModulesDst, { recursive: true });

// prisma CLI — resolve symlink so we get the real package directory
const prismaCliSrc = path.join(dbNodeModulesSrc, 'prisma');
if (fs.existsSync(prismaCliSrc)) {
  copy(prismaCliSrc, path.join(dbNodeModulesDst, 'prisma'));
}

// Full @prisma namespace — use the pnpm virtual store's shared hoisted copy
// which includes client, engines, debug, fetch-engine, get-platform, etc.
const pnpmSharedPrisma = path.join(repoRoot, 'node_modules', '.pnpm', 'node_modules', '@prisma');
if (fs.existsSync(pnpmSharedPrisma)) {
  console.log('[stage] app-db @prisma/* from pnpm shared store');
  copy(pnpmSharedPrisma, path.join(dbNodeModulesDst, '@prisma'));
} else {
  // Fallback: copy whatever @prisma subpackages are linked in packages/db
  const fallbackSrc = path.join(dbNodeModulesSrc, '@prisma');
  if (fs.existsSync(fallbackSrc)) {
    copy(fallbackSrc, path.join(dbNodeModulesDst, '@prisma'));
  }
}

// .prisma (query engine) lives as a sibling of @prisma/client in the pnpm
// store, NOT inside packages/db/node_modules. Resolve the real location via
// the @prisma/client symlink, then copy its sibling .prisma directory.
const clientLink = path.join(dbNodeModulesSrc, '@prisma', 'client');
const pnpmClientReal = path.join(repoRoot, 'node_modules', '.pnpm', '@prisma+client@5.22.0_prisma@5.22.0', 'node_modules', '.prisma');
// Try the well-known pnpm store path first, then resolve via symlink
let dotPrismaSrc = pnpmClientReal;
if (!fs.existsSync(dotPrismaSrc) && fs.existsSync(clientLink)) {
  const realClient = fs.realpathSync(clientLink);
  dotPrismaSrc = path.resolve(realClient, '..', '..', '.prisma');
}
if (fs.existsSync(dotPrismaSrc)) {
  console.log(`[stage] app-db .prisma engine from ${dotPrismaSrc}`);
  copy(dotPrismaSrc, path.join(dbNodeModulesDst, '.prisma'));
} else {
  console.warn('[stage] WARNING: .prisma engine directory not found — migrate will fail');
}

// --- app-worker: dist + needed node_modules ---
const appWorkerStaged = path.join(stagedRoot, 'app-worker');
console.log('[stage] app-worker');
copy(path.join(repoRoot, 'apps/worker/dist'), path.join(appWorkerStaged, 'dist'));

// Worker node_modules: copy everything dereferenced. We trade extra disk for
// correctness — pnpm's selective filter is too fragile.
copy(
  path.join(repoRoot, 'apps/worker/node_modules'),
  path.join(appWorkerStaged, 'node_modules'),
  // Drop docs and tests to keep size reasonable
  {
    filter: (src) => {
      const base = path.basename(src);
      if (base === 'test' || base === 'tests') return false;
      if (base.endsWith('.md')) return false;
      return true;
    },
  }
);

// ms-playwright (chromium) — copy as-is, no dereference needed (real files)
const msPwSrc = path.join(repoRoot, 'apps/worker/ms-playwright');
const msPwDst = path.join(appWorkerStaged, 'ms-playwright');
if (fs.existsSync(msPwSrc)) {
  console.log('[stage] app-worker/ms-playwright');
  copy(msPwSrc, msPwDst, {
    filter: (src) => !path.basename(src).startsWith('chromium_headless_shell-'),
  });
}

// Write minimal package.json with type:module to both staged dirs.
// Electron's run-as-node mode lacks Node 20.18's auto-detect-and-reparse
// fallback, so ESM-syntax dist/*.js files MUST have a parent package.json
// declaring "type": "module" or they fail with "Cannot use import statement
// outside a module". Both apps/db and apps/worker are ESM packages.
const moduleStub = JSON.stringify({ name: 'staged', private: true, type: 'module' }, null, 2) + '\n';
fs.writeFileSync(path.join(appDbStaged, 'package.json'), moduleStub);
fs.writeFileSync(path.join(appWorkerStaged, 'package.json'), moduleStub);
console.log('[stage] wrote type:module package.json to staged dirs');

console.log('[stage] done');
