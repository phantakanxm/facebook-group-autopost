import type { PrismaClient } from '@prisma/client';
import type { Page } from 'playwright';
import { launchBrowser } from '../playwright/browser.js';
import { detectFBState } from '../playwright/detect.js';
import { logger } from '../logger.js';
import { parseGroupUrl } from '@app/shared';
import { cleanGroupName } from './groupName.js';

// FB's groups sidebar is a virtualized list: only ~15–20 items render at a time.
// Without scrolling, our $$eval misses everything past the initial viewport.
// This helper scrolls every scrollable ancestor of the group anchors until the
// count stops growing across `idleThreshold` consecutive rounds.
async function scrollUntilGroupsExhausted(
  page: Page,
  opts: { maxRounds?: number; idleThreshold?: number; pauseMs?: number } = {},
): Promise<number> {
  const { maxRounds = 120, idleThreshold = 6, pauseMs = 1200 } = opts;
  let lastCount = 0;
  let idleRounds = 0;

  for (let i = 0; i < maxRounds; i++) {
    await page.evaluate(() => {
      // Scroll the document body to bottom (covers main-content lists).
      window.scrollTo(0, document.documentElement.scrollHeight);

      // Find every scrollable ancestor of group anchors and push it to its end
      // so virtualized lists in the sidebar / nav also load more rows.
      const anchors = Array.from(document.querySelectorAll('a[href*="/groups/"]'));
      const containers = new Set<HTMLElement>();
      for (const a of anchors) {
        let el: HTMLElement | null = a.parentElement;
        while (el && el !== document.body) {
          const cs = window.getComputedStyle(el);
          if (
            (cs.overflowY === 'auto' || cs.overflowY === 'scroll') &&
            el.scrollHeight > el.clientHeight + 4
          ) {
            containers.add(el);
            break;
          }
          el = el.parentElement;
        }
      }
      for (const c of containers) {
        c.scrollTop = c.scrollHeight;
      }
    });
    await page.waitForTimeout(pauseMs);

    const count = await page.$$eval('a[href*="/groups/"]', (els) =>
      els.filter((a) => /\/groups\/[\w.-]+\/?$/.test((a as HTMLAnchorElement).href)).length,
    );
    if (count === lastCount) {
      idleRounds++;
      if (idleRounds >= idleThreshold) {
        logger.info({ rounds: i + 1, count }, 'auto-sync scroll exhausted');
        return count;
      }
    } else {
      logger.info({ round: i + 1, count, prev: lastCount }, 'auto-sync scroll loaded more');
      lastCount = count;
      idleRounds = 0;
    }
  }
  logger.warn({ count: lastCount }, 'auto-sync scroll hit maxRounds — stopping');
  return lastCount;
}

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

    // Allow initial render then scroll-load every group in the virtualized list.
    await page.waitForTimeout(2_000);
    await scrollUntilGroupsExhausted(page);

    // Scrape group links + their visible name (innerText) from sidebar.
    // Group name is usually the anchor's innerText (may include extra spans).
    const items = await page.$$eval('a[href*="/groups/"]', (els) =>
      els
        .map((a) => {
          const anchor = a as HTMLAnchorElement;
          return {
            href: anchor.href,
            name: (anchor.innerText || anchor.textContent || '').trim(),
          };
        })
        .filter((it) => /\/groups\/[\w.-]+\/?$/.test(it.href)),
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
