import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect as pwExpect } from 'playwright/test';
import {
  selectHtmlDropdown,
  fillNumericField,
  resolveLocationAutocomplete,
} from './listing-helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fixtureUrl = pathToFileURL(
  resolve(__dirname, '../../test/fixtures/fb-listing-form.html'),
).toString();

describe('listing helpers (offline fixture)', () => {
  let browser: Browser;
  let ctx: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    ctx = await browser.newContext();
    page = await ctx.newPage();
  });
  afterAll(async () => {
    await browser.close();
  });

  it('selectHtmlDropdown picks option by value', async () => {
    await page.goto(fixtureUrl);
    await selectHtmlDropdown(page, '#kind', 'sale');
    const value = await page.locator('#kind').inputValue();
    expect(value).toBe('sale');
  });

  it('fillNumericField clears and types digits', async () => {
    await page.goto(fixtureUrl);
    await fillNumericField(page, '#price', 3500000);
    const value = await page.locator('#price').inputValue();
    expect(value).toBe('3500000');
  });

  it('resolveLocationAutocomplete types and picks first suggestion', async () => {
    await page.goto(fixtureUrl);
    await resolveLocationAutocomplete(page, '#location', '#location-suggestions', 'Urban Property Udon');
    await pwExpect(page.locator('#location')).toHaveAttribute('data-selected', 'true');
    const value = await page.locator('#location').inputValue();
    expect(value).toContain('Urban Property Udon');
  });
});
