// apps/worker/src/playwright/session.ts
import type { BrowserContext } from 'playwright';
import { launchBrowser } from './browser.js';
import { detectFBState } from './detect.js';
import { sleep } from '../utils/delays.js';
import { prisma } from '@app/db';
import { logger } from '../logger.js';

export interface SessionCheckResult {
  valid: boolean;
  reason?: string;
}

/**
 * Open FB homepage with the persistent session and check login state.
 * Used both for initial setup and for pre-flight validation before each campaign.
 */
export async function verifySession(userId: string): Promise<SessionCheckResult> {
  const ctx = await launchBrowser({ userId, headless: false });
  try {
    const page = await ctx.newPage();
    await page.goto('https://www.facebook.com/me', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await sleep(2_000);
    const state = await detectFBState(page);
    const valid = state.type === 'ok' && !page.url().includes('/login');

    await prisma.user.update({
      where: { id: userId },
      data: { sessionValid: valid, sessionChecked: new Date() },
    });

    logger.info({ userId, valid, state: state.type }, 'session verify');
    return valid ? { valid: true } : { valid: false, reason: state.type };
  } finally {
    await ctx.close();
  }
}

/**
 * Open a headed browser so the user can log in (including 2FA).
 * Cookies persist automatically via launchPersistentContext.
 * Resolves after the user closes the window OR after 10 min timeout.
 */
export async function openSessionSetup(userId: string): Promise<void> {
  const ctx = await launchBrowser({ userId, headless: false });
  try {
    const page = await ctx.newPage();
    await page.goto('https://www.facebook.com/login', { waitUntil: 'domcontentloaded' });
    logger.info({ userId }, 'session setup opened — waiting for user to close window');
    await ctx.waitForEvent('close', { timeout: 10 * 60_000 });
  } finally {
    // context may already be closed by user
    try { await ctx.close(); } catch {}
  }
}
