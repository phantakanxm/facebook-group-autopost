// apps/worker/src/playwright/post.ts
import type { BrowserContext } from 'playwright';
import type { PostResult } from '@app/shared';
import { SELECTORS, firstMatch } from './selectors.js';
import { humanClick, humanPaste, humanScroll } from './human.js';
import { detectFBState } from './detect.js';
import { humanDelay, sleep } from '../utils/delays.js';
import { logger } from '../logger.js';

export interface PostInput {
  fbUrl: string;
  content: string;
  mediaFiles: string[];
  enableScrollBeforePost: boolean;
  delayBeforePost: { min: number; max: number };
  delayAfterFocus: { min: number; max: number };
}

export async function postToGroup(
  ctx: BrowserContext,
  input: PostInput,
): Promise<PostResult> {
  const log = logger.child({ fbUrl: input.fbUrl });
  const page = await ctx.newPage();
  try {
    await page.goto(input.fbUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await humanDelay(2_000, 5_000);

    let state = await detectFBState(page);
    if (state.type !== 'ok') {
      return { success: false, errorCategory: state.type, ...(state.detail !== undefined && { error: state.detail }) };
    }

    if (input.enableScrollBeforePost) await humanScroll(page);

    const composerSelector = await firstMatch(page, SELECTORS.composerOpen);
    if (!composerSelector) {
      return { success: false, errorCategory: 'selector_not_found', error: 'composer not found' };
    }
    await humanClick(page, composerSelector);
    await humanDelay(input.delayAfterFocus.min, input.delayAfterFocus.max);

    await humanPaste(page, SELECTORS.composerEditable, input.content);
    await humanDelay(input.delayBeforePost.min, input.delayBeforePost.max);

    if (input.mediaFiles.length > 0) {
      const attachSel = await firstMatch(page, SELECTORS.attachMedia);
      if (attachSel) {
        await humanClick(page, attachSel);
        await humanDelay(500, 1500);
      }
      await page.setInputFiles(SELECTORS.fileInput, input.mediaFiles);
      // Wait for thumbnails to render — simple heuristic (longer delay for video)
      await sleep(3_000 + input.mediaFiles.length * 1_500);
      await humanDelay(1_000, 3_000);
    }

    const submitSel = await firstMatch(page, SELECTORS.submitPost);
    if (!submitSel) {
      return { success: false, errorCategory: 'selector_not_found', error: 'submit not found' };
    }
    await humanClick(page, submitSel);

    // Wait for post to complete or error to appear
    await sleep(4_000);

    state = await detectFBState(page);
    if (state.type !== 'ok') {
      return { success: false, errorCategory: state.type, ...(state.detail !== undefined && { error: state.detail }) };
    }

    const pendingApproval = await page.locator(SELECTORS.pendingApproval).count();
    if (pendingApproval > 0) {
      return { success: true, note: 'pending_approval' };
    }

    log.info('post submitted');
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err: msg }, 'postToGroup failed');
    return { success: false, errorCategory: 'transient', error: msg };
  } finally {
    await page.close();
  }
}
