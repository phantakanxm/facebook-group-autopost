import type { PrismaClient } from '@prisma/client';
import { launchBrowser } from '../playwright/browser.js';
import { detectFBState } from '../playwright/detect.js';
import { SELECTORS, firstMatch } from '../playwright/selectors.js';
import { humanDelay, sleep } from '../utils/delays.js';
import { logger } from '../logger.js';

export interface ScanCapabilitiesOpts {
  /** If true, re-scan groups that already have a `listingScannedAt` value. */
  force?: boolean;
}

/**
 * Visit active groups for the user and check whether the "Sell Something"
 * button exists in the group feed. Stores `supportsListing` + `listingScannedAt`.
 *
 * By default skips groups that have been scanned before. Pass `{ force: true }`
 * to re-scan everything (e.g. when FB may have changed group capabilities).
 *
 * Slow (~5-10s/group) but capability rarely changes — run once per day/week.
 */
export async function scanGroupCapabilities(
  userId: string,
  prisma: PrismaClient,
  opts: ScanCapabilitiesOpts = {},
): Promise<{ scanned: number; listingCapable: number; skipped: number }> {
  const groups = await prisma.group.findMany({
    where: {
      userId,
      isActive: true,
      ...(opts.force ? {} : { listingScannedAt: null }),
    },
    orderBy: { createdAt: 'asc' },
  });

  // Report how many active groups were skipped (already scanned + not forced)
  const totalActive = await prisma.group.count({
    where: { userId, isActive: true },
  });
  const skipped = totalActive - groups.length;

  if (groups.length === 0) {
    logger.info({ skipped, totalActive, force: opts.force ?? false }, 'capability scan: nothing to do');
    return { scanned: 0, listingCapable: 0, skipped };
  }

  const ctx = await launchBrowser({ userId, headless: false });
  let listingCapable = 0;
  try {
    const page = await ctx.newPage();
    for (const g of groups) {
      try {
        await page.goto(g.fbUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
        await sleep(3_000);
        const state = await detectFBState(page);
        if (state.type !== 'ok') {
          logger.warn({ fbGroupId: g.fbGroupId, state: state.type }, 'scan skipped');
          continue;
        }
        const found = await firstMatch(page, SELECTORS.listingButton);
        const supports = found !== null;
        await prisma.group.update({
          where: { id: g.id },
          data: { supportsListing: supports, listingScannedAt: new Date() },
        });
        if (supports) listingCapable++;
        logger.info({ fbGroupId: g.fbGroupId, supports }, 'scan result');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn({ fbGroupId: g.fbGroupId, err: msg }, 'scan error — continuing');
      }
      // Human-like delay between groups (short since we're only reading, not posting)
      await humanDelay(2_000, 5_000);
    }
    logger.info({ scanned: groups.length, listingCapable, skipped, force: opts.force ?? false }, 'capability scan complete');
    return { scanned: groups.length, listingCapable, skipped };
  } finally {
    await ctx.close();
  }
}
