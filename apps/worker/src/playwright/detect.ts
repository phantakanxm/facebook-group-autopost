import type { Page } from 'playwright';
import type { FBState } from '@app/shared';
import { SELECTORS } from './selectors.js';

export async function detectFBState(page: Page): Promise<FBState> {
  const url = page.url();

  if (url.includes('/checkpoint') || url.includes('/login')) {
    return { type: 'session_invalid', detail: `url=${url}` };
  }

  if ((await page.locator(SELECTORS.checkpointMarker).count()) > 0) {
    return { type: 'account_locked', detail: 'checkpoint element' };
  }

  if ((await page.locator(SELECTORS.rateLimitText).count()) > 0) {
    return { type: 'rate_limited', detail: 'rate limit banner' };
  }

  if ((await page.locator(SELECTORS.groupUnavailableText).count()) > 0) {
    return { type: 'group_unavailable', detail: 'content not found' };
  }

  return { type: 'ok' };
}
