import type { BrowserContext } from 'playwright';
import type { PostResult } from '@app/shared';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { SELECTORS, firstMatch, propertyTypeOption, shareGroupCheckboxByName } from './selectors.js';
import { humanClick, humanScroll } from './human.js';
import {
  selectCombobox,
  fillNumericField,
  resolveLocationAutocomplete,
} from './listing-helpers.js';
import { detectFBState } from './detect.js';
import { humanDelay, sleep } from '../utils/delays.js';
import { logger } from '../logger.js';

export interface ListingBatchInput {
  primaryGroupFbUrl: string;
  shareGroupNames: string[];

  listingKind: 'sale' | 'rent';
  propertyType: 'flat' | 'house' | 'townhouse';
  bedrooms: number;
  bathrooms: number;
  priceBaht: number;
  squareMetres?: number | null;
  location: string;
  description: string;
  mediaFiles: string[];
}

function screenshotPath(tag: string): string {
  const dir = resolve(process.cwd(), 'logs', 'screenshots');
  mkdirSync(dir, { recursive: true });
  return resolve(dir, `listing-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`);
}

export async function postListingBatch(
  ctx: BrowserContext,
  input: ListingBatchInput,
): Promise<PostResult> {
  const log = logger.child({ primary: input.primaryGroupFbUrl, shares: input.shareGroupNames.length });
  const page = await ctx.newPage();
  const missingShareGroups: string[] = [];

  async function fail(
    category: PostResult['errorCategory'],
    msg: string,
  ): Promise<PostResult> {
    try {
      const path = screenshotPath(category ?? 'err');
      await page.screenshot({ path, fullPage: false });
      log.warn({ category, path }, 'listing batch failed');
      return category !== undefined
        ? { success: false, errorCategory: category, error: `${msg} (screenshot=${path})` }
        : { success: false, error: `${msg} (screenshot=${path})` };
    } catch {
      return category !== undefined
        ? { success: false, errorCategory: category, error: msg }
        : { success: false, error: msg };
    }
  }

  try {
    // 1. Navigate to primary group
    await page.goto(input.primaryGroupFbUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await humanDelay(2_000, 5_000);
    let state = await detectFBState(page);
    if (state.type !== 'ok') return await fail(state.type, state.detail ?? 'navigate state');

    // 2. Click Sell Something
    const listingBtn = await firstMatch(page, SELECTORS.listingButton);
    if (!listingBtn) return await fail('selector_not_found', 'Sell Something button missing');
    await humanClick(page, listingBtn);
    await humanDelay(1_000, 2_000);

    // 3. Wait for dialog content to render (skeleton → real UI) and branch:
    //    • Some groups show a category chooser — click "Property for sale or rent"
    //    • Property-specific groups open the form directly — skip category step
    let categoryBtn: string | null = null;
    let kindComboEarly: string | null = null;
    const dialogDeadline = Date.now() + 15_000;
    while (Date.now() < dialogDeadline) {
      categoryBtn = await firstMatch(page, SELECTORS.listingCategoryPropertyForSaleOrRent);
      if (categoryBtn) break;
      kindComboEarly = await firstMatch(page, SELECTORS.listingKindCombobox);
      if (kindComboEarly) break;
      await sleep(500);
    }
    if (categoryBtn) {
      await humanClick(page, categoryBtn);
      // Wait for the listing form to render after category selection. Use either the
      // kind combobox (dropdown) or a scoped photo input as the "form is ready" marker.
      const formDeadline = Date.now() + 15_000;
      while (Date.now() < formDeadline) {
        if (await firstMatch(page, SELECTORS.listingKindCombobox)) break;
        if ((await page.locator('[role="dialog"] input[type="file"]').count()) > 0) break;
        await sleep(500);
      }
      await humanDelay(500, 1_500);
    } else if (kindComboEarly) {
      log.info('listing form opened directly — skipping category chooser');
    } else {
      return await fail('selector_not_found', 'Category chooser or listing form did not render within 15s');
    }

    // 4. Upload photos first
    const photoInputSelectors = [
      '[role="dialog"] input[type="file"][accept*="image"]',
      '[role="dialog"] input[type="file"]',
    ];
    const photoInput = await firstMatch(page, photoInputSelectors);
    if (!photoInput) return await fail('selector_not_found', 'listing photo input missing');
    await page.setInputFiles(photoInput, input.mediaFiles);
    await sleep(3_000 + input.mediaFiles.length * 800);
    await humanDelay(1_000, 3_000);

    // 5. Sale/rent combobox
    const kindCombo = await firstMatch(page, SELECTORS.listingKindCombobox);
    if (!kindCombo) return await fail('selector_not_found', 'listingKind combobox missing');
    const kindOption = input.listingKind === 'sale'
      ? SELECTORS.listingKindOptionSale[0]!
      : SELECTORS.listingKindOptionRent[0]!;
    await selectCombobox(page, kindCombo, kindOption);

    // 5b. Property type combobox
    const typeCombo = await firstMatch(page, SELECTORS.propertyTypeCombobox);
    if (!typeCombo) return await fail('selector_not_found', 'propertyType combobox missing');
    await selectCombobox(page, typeCombo, propertyTypeOption(input.propertyType));

    // 6. Numeric fields
    const bedsSel = await firstMatch(page, SELECTORS.listingBedroomsInput);
    if (!bedsSel) return await fail('selector_not_found', 'bedrooms input missing');
    await fillNumericField(page, bedsSel, input.bedrooms);

    const bathsSel = await firstMatch(page, SELECTORS.listingBathroomsInput);
    if (!bathsSel) return await fail('selector_not_found', 'bathrooms input missing');
    await fillNumericField(page, bathsSel, input.bathrooms);

    const priceSel = await firstMatch(page, SELECTORS.listingPriceInput);
    if (!priceSel) return await fail('selector_not_found', 'price input missing');
    await fillNumericField(page, priceSel, input.priceBaht);

    if (typeof input.squareMetres === 'number') {
      const sqmSel = await firstMatch(page, SELECTORS.listingSqmInput);
      if (sqmSel) {
        await fillNumericField(page, sqmSel, input.squareMetres);
      }
    }

    // 7. Location autocomplete
    const locCombo = await firstMatch(page, SELECTORS.listingLocationCombobox);
    if (!locCombo) return await fail('selector_not_found', 'location combobox missing');
    const resolved = await resolveLocationAutocomplete(
      page,
      locCombo,
      '[role="listbox"]',
      input.location,
    );
    if (!resolved) return await fail('transient', 'location_not_resolved');
    await humanDelay(300, 700);

    // 8. Description
    const descSel = await firstMatch(page, SELECTORS.listingDescriptionTextbox);
    if (!descSel) return await fail('selector_not_found', 'description textbox missing');
    await page.locator(descSel).first().click();
    await humanDelay(250, 500);
    await page.keyboard.insertText(input.description);
    await humanDelay(500, 1_500);

    // 9. Click Next
    await humanScroll(page);
    const nextBtn = await firstMatch(page, SELECTORS.listingNextButton);
    if (!nextBtn) return await fail('selector_not_found', 'Next button missing');
    await humanClick(page, nextBtn);
    await humanDelay(2_000, 4_000);

    // 10. Select share groups
    if (input.shareGroupNames.length > 0) {
      const search = await firstMatch(page, SELECTORS.shareGroupSearch);
      for (const name of input.shareGroupNames) {
        try {
          if (search) {
            await page.locator(search).first().click();
            await page.locator(search).first().fill('');
            await humanDelay(150, 300);
            await page.keyboard.insertText(name);
            await sleep(800);
          }
          const checkbox = page.locator(shareGroupCheckboxByName(name)).first();
          await checkbox.waitFor({ state: 'visible', timeout: 4_000 });
          await checkbox.click();
          await humanDelay(400, 800);
        } catch {
          log.warn({ name }, 'share group not found in list, skipping');
          missingShareGroups.push(name);
        }
      }
    }

    // 11. Click Publish
    const pubBtn = await firstMatch(page, SELECTORS.listingPublishButton);
    if (!pubBtn) return await fail('selector_not_found', 'Publish button missing');
    await humanClick(page, pubBtn);
    await sleep(6_000);

    // 12. Verify
    state = await detectFBState(page);
    if (state.type !== 'ok') return await fail(state.type, state.detail ?? 'post-publish state');
    const banner = await page.locator(SELECTORS.listingPublishedBanner).count();
    const note = missingShareGroups.length > 0 ? `partial_share:${missingShareGroups.join(',')}` : undefined;
    const fbPostUrl = page.url();

    log.info({ banner, missingShareGroups }, 'listing submitted');

    if (banner === 0 && missingShareGroups.length === input.shareGroupNames.length + 1) {
      // extremely suspicious — neither banner nor any group selected → fail
      return await fail('transient', 'no success signal detected');
    }

    const result: PostResult = { success: true, fbPostUrl };
    if (note !== undefined) result.note = note as 'pending_approval';
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err: msg }, 'postListingBatch exception');
    return await fail('transient', msg);
  } finally {
    await page.close();
  }
}
