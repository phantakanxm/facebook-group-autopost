// apps/worker/src/playwright/selectors.ts
//
// FB selectors are tied to accessible names (role=button[name=...]).
// We use bilingual regex (Thai + English) since the user's locale is th-TH.
// Keep this file the single source of truth; update when FB changes UI.

export const SELECTORS = {
  // Composer entry point in a group feed ("เขียนอะไรบางอย่าง..." / "Write something...")
  composerOpen: [
    'role=button[name=/เขียนบางสิ่งบางอย่าง|เขียนอะไรบางอย่าง|Write something/i]',
    'role=textbox[name=/เขียน|Write/i]',
  ],
  // The actual composer editable area
  composerEditable: '[contenteditable="true"][role="textbox"]',
  // The attach-photo button inside composer — kept for reference but we do NOT click
  // it during posting (the OS file picker would pop up). Playwright.setInputFiles can
  // target the hidden input directly.
  attachMedia: [
    'role=button[name=/รูปภาพ\\/วิดีโอ|Photo\\/video|Photo|Video|รูปภาพ|วิดีโอ/i]',
  ],
  // Hidden <input type=file> — must be scoped: FB has ~5 file inputs on the page
  // (profile pic, cover, story, composer, etc). These selectors match the composer's.
  // Try scoped-to-dialog first, then fall back to accept-attribute signatures.
  imageFileInput: [
    '[role="dialog"] input[type="file"][accept*="image"]',
    'input[type="file"][accept*="image/heic"]',
    'input[type="file"][accept*="image/"][multiple]',
  ],
  videoFileInput: [
    '[role="dialog"] input[type="file"][accept*="video"]',
    'input[type="file"][accept*="video/"]',
  ],
  // Final submit button
  submitPost: [
    'role=button[name=/^โพสต์$|^Post$/i]',
  ],
  // "Sell Something" entry point — indicates the group supports Marketplace listings
  listingButton: [
    'role=button[name=/ประกาศขาย|Sell Something|Sell something|List for Sale|List something for sale/i]',
    'role=link[name=/ประกาศขาย|Sell Something|Sell something|List for Sale/i]',
  ],
  // Success signals
  composerClosed: '[contenteditable="true"][role="textbox"]',
  // Pending approval banner after submit
  pendingApproval: 'text=/รอการอนุมัติ|pending admin approval|pending approval/i',
  // Error signals
  rateLimitText: 'text=/คุณทำเร็วเกินไป|You.?re Going Too Fast/i',
  groupUnavailableText: 'text=/ไม่พบเนื้อหา|Content Not Found|This content isn.?t available/i',
  checkpointMarker: '[data-testid="checkpoint"]',
} as const;

/**
 * Try each selector in order; return first that matches (count > 0).
 * Use for multi-selector fallback chains.
 */
export async function firstMatch(
  page: import('playwright').Page,
  selectors: readonly string[],
): Promise<string | null> {
  for (const s of selectors) {
    if ((await page.locator(s).count()) > 0) return s;
  }
  return null;
}
