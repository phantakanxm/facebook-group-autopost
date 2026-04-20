// apps/worker/src/playwright/post.ts
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
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
  /** 'images' | 'video' | 'none' — selects which hidden file input to target. */
  mediaType: 'images' | 'video' | 'none';
  enableScrollBeforePost: boolean;
  delayBeforePost: { min: number; max: number };
  delayAfterFocus: { min: number; max: number };
}

function screenshotPath(): string {
  const dir = resolve(process.cwd(), 'logs', 'screenshots');
  mkdirSync(dir, { recursive: true });
  return resolve(dir, `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`);
}

export async function postToGroup(
  ctx: BrowserContext,
  input: PostInput,
): Promise<PostResult> {
  const log = logger.child({ fbUrl: input.fbUrl });

  async function fail(
    p: import('playwright').Page,
    category: import('@app/shared').PostResult['errorCategory'],
    msg: string,
  ): Promise<import('@app/shared').PostResult> {
    try {
      const path = screenshotPath();
      await p.screenshot({ path, fullPage: false });
      log.warn({ category, path }, 'post failed');
      return category !== undefined
        ? { success: false, errorCategory: category, error: `${msg} (screenshot=${path})` }
        : { success: false, error: `${msg} (screenshot=${path})` };
    } catch {
      return category !== undefined
        ? { success: false, errorCategory: category, error: msg }
        : { success: false, error: msg };
    }
  }

  const page = await ctx.newPage();
  try {
    await page.goto(input.fbUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await humanDelay(2_000, 5_000);

    let state = await detectFBState(page);
    if (state.type !== 'ok') {
      return await fail(page, state.type, state.detail ?? 'detected bad state');
    }

    if (input.enableScrollBeforePost) await humanScroll(page);

    const composerSelector = await firstMatch(page, SELECTORS.composerOpen);
    if (!composerSelector) {
      return await fail(page, 'selector_not_found', 'composer not found');
    }
    await humanClick(page, composerSelector);
    await humanDelay(input.delayAfterFocus.min, input.delayAfterFocus.max);

    await humanPaste(page, SELECTORS.composerEditable, input.content);
    await humanDelay(input.delayBeforePost.min, input.delayBeforePost.max);

    if (input.mediaFiles.length > 0) {
      // Do NOT click the visible "Photo/Video" button — that opens the OS file picker
      // and blocks JS. Playwright's setInputFiles works on hidden inputs directly.
      const candidates = input.mediaType === 'video' ? SELECTORS.videoFileInput : SELECTORS.imageFileInput;
      const inputSel = await firstMatch(page, candidates);
      if (!inputSel) {
        return await fail(page, 'selector_not_found', `${input.mediaType} file input not found`);
      }
      await page.setInputFiles(inputSel, input.mediaFiles);
      // Wait for thumbnails to render — simple heuristic (longer delay for video)
      await sleep(3_000 + input.mediaFiles.length * 1_500);
      await humanDelay(1_000, 3_000);
    }

    const submitSel = await firstMatch(page, SELECTORS.submitPost);
    if (!submitSel) {
      return await fail(page, 'selector_not_found', 'submit not found');
    }
    await humanClick(page, submitSel);

    // Wait for post to complete or error to appear
    await sleep(4_000);

    state = await detectFBState(page);
    if (state.type !== 'ok') {
      return await fail(page, state.type, state.detail ?? 'detected bad state');
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
    return await fail(page, 'transient', msg);
  } finally {
    await page.close();
  }
}
