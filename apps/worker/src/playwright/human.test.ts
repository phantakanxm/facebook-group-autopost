import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { describe, it, expect as vitestExpect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { expect } from 'playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { humanClick, humanPaste } from './human.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fixtureUrl = pathToFileURL(
  resolve(__dirname, '../../test/fixtures/fb-composer.html'),
).toString();

describe('human toolkit (offline fixture)', () => {
  let browser: Browser;
  let ctx: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    ctx = await browser.newContext();
    page = await ctx.newPage();
  });
  afterAll(async () => { await browser.close(); });

  it('humanClick opens the composer', async () => {
    await page.goto(fixtureUrl);
    await humanClick(page, '#open-composer');
    await expect(page.locator('#composer')).toBeVisible();
  });

  it('humanPaste inserts text into the editor', async () => {
    await page.goto(fixtureUrl);
    await humanClick(page, '#open-composer');
    await humanPaste(page, '#editor', 'hello from bot');
    const value = await page.locator('#editor').innerText();
    vitestExpect(value).toBe('hello from bot');
  });
});
