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
  // The attach-photo button inside composer
  attachMedia: [
    'role=button[name=/รูปภาพ\\/วิดีโอ|Photo\\/video|Photo|Video|รูปภาพ|วิดีโอ/i]',
  ],
  // Hidden <input type=file> used by FB for upload
  fileInput: 'input[type="file"]',
  // Final submit button
  submitPost: [
    'role=button[name=/^โพสต์$|^Post$/i]',
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
