// Postbuild: copy assets that Next.js standalone output omits.
// - .next/static (chunks)
// - public/ (if it exists)
// - Prisma query engine native binary (.node) into standalone .prisma/client
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(webRoot, '..', '..');
const standaloneWeb = path.join(webRoot, '.next/standalone/apps/web');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.cpSync(src, dest, { recursive: true });
  return true;
}

// 1. .next/static
const staticSrc = path.join(webRoot, '.next/static');
const staticDst = path.join(standaloneWeb, '.next/static');
if (copyDir(staticSrc, staticDst)) {
  console.log(`[postbuild] copied .next/static → standalone`);
} else {
  console.warn(`[postbuild] .next/static missing — skipped`);
}

// 2. public/
const publicSrc = path.join(webRoot, 'public');
const publicDst = path.join(standaloneWeb, 'public');
if (copyDir(publicSrc, publicDst)) {
  console.log(`[postbuild] copied public/ → standalone`);
}

// 3. Prisma query engine
function findPrismaEngines() {
  const engineSearchDirs = [
    path.join(repoRoot, 'packages/db/node_modules/.prisma/client'),
    // Fallback: pnpm sometimes nests it
    path.join(repoRoot, 'node_modules/.pnpm'),
  ];
  const found = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (/^libquery_engine-.+\.node$/.test(e.name)) {
        found.push(full);
      }
    }
  }
  for (const d of engineSearchDirs) walk(d);
  return found;
}

function findStandalonePrismaClientDirs() {
  const dirs = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'client' && path.basename(dir) === '.prisma') {
          dirs.push(full);
        } else {
          walk(full);
        }
      }
    }
  }
  walk(path.join(webRoot, '.next/standalone'));
  return dirs;
}

// Scan bundled route files for Prisma engine path references, then create
// those target directories and copy the engine into each one.
function findBundledEnginePaths() {
  const targets = new Set();
  const serverDir = path.join(standaloneWeb, '.next/server');
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.name.endsWith('.js')) {
        let src;
        try { src = fs.readFileSync(full, 'utf8'); } catch { continue; }
        // Find quoted paths that reference libquery_engine
        const re = /"([^"]*libquery_engine[^"]*\.node)"/g;
        let m;
        while ((m = re.exec(src)) !== null) {
          const ref = m[1];
          // Only handle relative paths (starting with . or ../../ etc.)
          if (ref.startsWith('.')) {
            const target = path.resolve(path.dirname(full), ref);
            targets.add(path.dirname(target));
          }
        }
      }
    }
  }
  walk(serverDir);
  return [...targets];
}

const engines = findPrismaEngines();
const standalonePrismaTargets = findStandalonePrismaClientDirs();
const bundledEngineDirs = findBundledEnginePaths();

// Deduplicate all target dirs
const allTargetDirs = new Set([...standalonePrismaTargets, ...bundledEngineDirs]);

if (engines.length === 0) {
  console.warn('[postbuild] no Prisma query engine .node found — Prisma routes will fail at runtime');
} else if (allTargetDirs.size === 0) {
  console.warn('[postbuild] no Prisma engine target dirs found in standalone — engine not copied');
} else {
  for (const tgt of allTargetDirs) {
    fs.mkdirSync(tgt, { recursive: true });
    for (const eng of engines) {
      const dst = path.join(tgt, path.basename(eng));
      if (!fs.existsSync(dst)) {
        fs.copyFileSync(eng, dst);
        console.log(`[postbuild] copied ${path.basename(eng)} → ${path.relative(repoRoot, dst)}`);
      }
    }
  }
}

console.log('[postbuild] done');
