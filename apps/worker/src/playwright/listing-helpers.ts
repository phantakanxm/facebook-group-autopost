import type { Page } from 'playwright';
import { humanDelay, sleep } from '../utils/delays.js';

/**
 * Select an option from a classic HTML <select> by its value attribute.
 * Used by fixture tests. The real FB UI uses role=combobox with role=option,
 * handled by selectCombobox below.
 */
export async function selectHtmlDropdown(
  page: Page,
  selector: string,
  value: string,
): Promise<void> {
  await page.locator(selector).selectOption(value);
}

/**
 * Open a FB role=combobox, wait for the listbox to appear, click the option
 * whose accessible name matches the provided locator selector.
 *
 * The caller is responsible for providing a selector that already targets
 * the correct option (e.g. `role=option[name=/^Sale$/i]`).
 */
export async function selectCombobox(
  page: Page,
  comboboxSelector: string,
  optionSelector: string,
): Promise<void> {
  const combo = page.locator(comboboxSelector).first();
  await combo.click();
  await sleep(400 + Math.random() * 600);
  const option = page.locator(optionSelector).first();
  await option.waitFor({ state: 'visible', timeout: 5_000 });
  await option.click();
  await humanDelay(300, 800);
}

/**
 * Focus a numeric input, clear it, type the digits with human-like delay, Tab out.
 */
export async function fillNumericField(
  page: Page,
  selector: string,
  value: number,
): Promise<void> {
  const field = page.locator(selector).first();
  await field.click();
  await field.fill('');
  await humanDelay(150, 400);
  const digits = String(Math.trunc(value));
  for (const ch of digits) {
    await page.keyboard.type(ch, { delay: 50 + Math.random() * 100 });
  }
  await humanDelay(150, 350);
  await page.keyboard.press('Tab');
}

/**
 * Fill a FB location autocomplete:
 *  1. Click the textbox to focus.
 *  2. keyboard.insertText(query) so React sees the input event.
 *  3. Wait up to 3s for the suggestion listbox to become visible.
 *  4. Click the first option.
 *  5. Fallback once with a shorter query before giving up.
 *
 * Returns true if a suggestion was picked, false otherwise.
 */
export async function resolveLocationAutocomplete(
  page: Page,
  textboxSelector: string,
  listboxSelector: string,
  query: string,
): Promise<boolean> {
  const pick = async (text: string): Promise<boolean> => {
    const textbox = page.locator(textboxSelector).first();
    await textbox.click();
    await textbox.fill('');
    await humanDelay(200, 500);
    await page.keyboard.insertText(text);
    try {
      await page.locator(listboxSelector).first().waitFor({ state: 'visible', timeout: 3_000 });
    } catch {
      return false;
    }
    const first = page.locator(`${listboxSelector} [role="option"]`).first();
    await first.click();
    return true;
  };

  if (await pick(query)) return true;
  const short = query.slice(0, Math.max(3, Math.floor(query.length / 2)));
  if (short !== query && (await pick(short))) return true;
  return false;
}
