import type { PrismaClient } from '@prisma/client';
import { launchBrowser } from '../playwright/browser.js';
import { detectFBState } from '../playwright/detect.js';
import { logger } from '../logger.js';
import { parseGroupUrl } from '@app/shared';
import { cleanGroupName } from './groupName.js';

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

    // Scrape group links + their visible name (innerText) from sidebar.
    // Group name is usually the anchor's innerText (may include extra spans).
    await page.waitForTimeout(3_000);
    const items = await page.$$eval('a[href*="/groups/"]', (els) =>
      els
        .map((a) => {
          const anchor = a as HTMLAnchorElement;
          return {
            href: anchor.href,
            name: (anchor.innerText || anchor.textContent || '').trim(),
          };
        })
        .filter((it) => /\/groups\/\w+\/?$/.test(it.href)),
    );

    // Dedupe by fbGroupId; prefer entries that have a non-empty name.
    const byId = new Map<string, { fbGroupId: string; canonicalUrl: string; name: string }>();
    for (const it of items) {
      const p = parseGroupUrl(it.href);
      if (!p) continue;
      const cleanName = cleanGroupName(it.name);
      const existing = byId.get(p.fbGroupId);
      if (!existing || (!existing.name && cleanName)) {
        byId.set(p.fbGroupId, { fbGroupId: p.fbGroupId, canonicalUrl: p.canonicalUrl, name: cleanName });
      }
    }

    let added = 0, updated = 0;
    for (const g of byId.values()) {
      const existing = await prisma.group.findUnique({
        where: { userId_fbGroupId: { userId, fbGroupId: g.fbGroupId } },
      });
      if (existing) {
        // Backfill name if it was empty before
        if (!existing.name && g.name) {
          await prisma.group.update({
            where: { id: existing.id },
            data: { name: g.name },
          });
        }
        updated++;
        continue;
      }
      await prisma.group.create({
        data: {
          userId,
          fbGroupId: g.fbGroupId,
          fbUrl: g.canonicalUrl,
          source: 'auto_sync',
          ...(g.name ? { name: g.name } : {}),
        },
      });
      added++;
    }
    logger.info({ added, updated, total: byId.size }, 'auto-sync complete');
    return { added, updated };
  } finally {
    await ctx.close();
  }
}
