import { chromium as playwrightExtraChromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { BrowserContext } from 'playwright';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

playwrightExtraChromium.use(StealthPlugin());

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

export interface LaunchOptions {
  userId: string;
  headless?: boolean;
}

export async function launchBrowser(opts: LaunchOptions): Promise<BrowserContext> {
  const sessionDir = resolve(process.cwd(), 'sessions', opts.userId);
  mkdirSync(sessionDir, { recursive: true });

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
  return resolve(process.cwd(), 'sessions', userId);
}
