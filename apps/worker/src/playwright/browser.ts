import { chromium as playwrightExtraChromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { BrowserContext } from 'playwright';
import path from 'node:path';
import { mkdirSync, rmSync } from 'node:fs';
import { paths } from '../paths.js';

playwrightExtraChromium.use(StealthPlugin());

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

export interface LaunchOptions {
  userId: string;
  headless?: boolean;
}

// Chromium creates SingletonLock/SingletonCookie/SingletonSocket in the profile
// dir to prevent multiple instances. If a previous run crashed or was force-killed
// before close, these linger and block the next launch with:
//   Failed to create a ProcessSingleton for your profile directory
// We're the only Chromium touching this profile, so it's safe to remove them.
function clearSingletonLocks(sessionDir: string): void {
  for (const name of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
    try {
      rmSync(path.join(sessionDir, name), { force: true });
    } catch {
      // best-effort; ignore missing or permission errors
    }
  }
}

export async function launchBrowser(opts: LaunchOptions): Promise<BrowserContext> {
  const sessionDir = path.join(paths.sessionRoot, opts.userId);
  mkdirSync(sessionDir, { recursive: true });
  clearSingletonLocks(sessionDir);

  const context = await playwrightExtraChromium.launchPersistentContext(sessionDir, {
    headless: opts.headless ?? false,
    viewport: { width: 1440, height: 900 },
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    userAgent: UA,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });

  return context;
}

export function sessionDirFor(userId: string): string {
  return path.join(paths.sessionRoot, userId);
}
