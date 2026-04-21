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
