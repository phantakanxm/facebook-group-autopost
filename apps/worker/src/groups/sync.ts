import type { PrismaClient } from '@prisma/client';
import { launchBrowser } from '../playwright/browser.js';
import { detectFBState } from '../playwright/detect.js';
import { logger } from '../logger.js';
import { parseGroupUrl } from '@app/shared';

export async function autoSyncGroups(userId: string, prisma: PrismaClient): Promise<{ added: number; updated: number }> {
  const ctx = await launchBrowser({ userId, headless: false });
  try {
    const page = await ctx.newPage();
    await page.goto('https://www.facebook.com/groups/feed/', { waitUntil: 'domcontentloaded' });
    const state = await detectFBState(page);
    if (state.type !== 'ok') {
      logger.warn({ state }, 'auto-sync aborted');
      return { added: 0, updated: 0 };
    }

    // Scrape group links from left sidebar. The anchor href pattern is stable:
    // /groups/{id}/ (the first link inside a sidebar item)
    await page.waitForTimeout(3_000);
    const hrefs: string[] = await page.$$eval('a[href*="/groups/"]', (els) =>
      els.map((a) => (a as HTMLAnchorElement).href).filter((h) => /\/groups\/\w+\/?$/.test(h)),
    );
    const unique = Array.from(new Set(hrefs));

    let added = 0, updated = 0;
    for (const href of unique) {
      const p = parseGroupUrl(href);
      if (!p) continue;
      const existing = await prisma.group.findUnique({
        where: { userId_fbGroupId: { userId, fbGroupId: p.fbGroupId } },
      });
      if (existing) {
        updated++;
        continue;
      }
      await prisma.group.create({
        data: {
          userId, fbGroupId: p.fbGroupId, fbUrl: p.canonicalUrl, source: 'auto_sync',
        },
      });
      added++;
    }
    logger.info({ added, updated }, 'auto-sync complete');
    return { added, updated };
  } finally {
    await ctx.close();
  }
}
