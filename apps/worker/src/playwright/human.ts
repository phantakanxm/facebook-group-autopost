import type { Page } from 'playwright';
import { humanDelay, sleep } from '../utils/delays.js';
import { bezierPath } from '../utils/bezier.js';

export async function humanMouseMove(page: Page, x: number, y: number): Promise<void> {
  const from = { x: 0, y: 0 };
  const steps = 20 + Math.floor(Math.random() * 15);
  const path = bezierPath(from, { x, y }, steps);
  for (const pt of path) {
    await page.mouse.move(pt.x, pt.y);
    await sleep(10 + Math.random() * 20);
  }
}

export async function humanClick(page: Page, selector: string): Promise<void> {
  const el = page.locator(selector).first();
  await el.waitFor({ state: 'visible', timeout: 15_000 });
  // page.mouse.click() uses viewport coordinates. If the element is below the
  // fold (e.g. after we humanScroll-d and the Next button is past the
  // viewport), boundingBox() returns y > viewport.height and the click hits
  // empty space. scrollIntoViewIfNeeded is a no-op when already in view.
  await el.scrollIntoViewIfNeeded({ timeout: 5_000 }).catch(() => undefined);
  const box = await el.boundingBox();
  if (!box) throw new Error(`humanClick: no bounding box for ${selector}`);
  const offsetX = box.width * (0.3 + Math.random() * 0.4);
  const offsetY = box.height * (0.3 + Math.random() * 0.4);
  const tx = box.x + offsetX;
  const ty = box.y + offsetY;
  await humanMouseMove(page, tx, ty);
  await humanDelay(200, 500);
  await page.mouse.click(tx, ty);
}

export async function humanPaste(page: Page, editorSelector: string, text: string): Promise<void> {
  // Click to focus — FB's composer (Lexical editor) needs a real click to activate.
  // Insert text line-by-line, pressing Enter between lines. `keyboard.insertText`
  // with embedded `\n` is swallowed by Lexical's paste handler; explicit Enter
  // presses generate a `beforeinput` event with `inputType: 'insertParagraph'` or
  // `'insertLineBreak'` which the editor honors.
  const el = page.locator(editorSelector).first();
  await el.click();
  await humanDelay(300, 800);
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.length > 0) {
      await page.keyboard.insertText(line);
    }
    if (i < lines.length - 1) {
      await page.keyboard.press('Enter');
    }
  }
  await humanDelay(300, 600);
}

export async function humanScroll(page: Page): Promise<void> {
  const amount = 100 + Math.random() * 500;
  const steps = 5 + Math.floor(Math.random() * 10);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, amount / steps);
    await sleep(50 + Math.random() * 150);
  }
  await humanDelay(1000, 3000);
  await page.mouse.wheel(0, -(amount * 0.5));
}
