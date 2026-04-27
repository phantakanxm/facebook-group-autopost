// apps/worker/src/playwright/selectors.ts
//
// FB selectors are tied to accessible names (role=button[name=...]).
// We use bilingual regex (Thai + English) since the user's locale is th-TH.
// Keep this file the single source of truth; update when FB changes UI.

export const SELECTORS = {
  // Composer entry point in a group feed. Thai FB cycles through several
  // placeholders depending on the group / rollout:
  //   "เขียนบางสิ่งบางอย่าง..."
  //   "เขียนอะไรบางอย่าง..."
  //   "คุณกำลังคิดอะไรอยู่..." (news-feed style, sometimes appears in groups)
  //   "สร้างโพสต์..."
  //   "เขียนโพสต์..."
  //   "เริ่มการสนทนา..."
  // English: "Write something...", "Create a post...", "What's on your mind..."
  composerOpen: [
    'role=button[name=/เขียน(บางสิ่ง|อะไร|โพสต์)|คิดอะไร|สร้างโพสต์|เริ่มการสนทนา|Write something|Create (a )?post|What.?s on your mind/i]',
    'role=textbox[name=/เขียน|คิดอะไร|สร้างโพสต์|Write|post|mind/i]',
    // Last-ditch: any role=button at the top of the group feed that opens a composer dialog
    'role=button[name=/^\\s*(เขียน|โพสต์|Post|Write)\\s*\\.?\\.?\\.?\\s*$/i]',
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
  // Final submit button. Strict-anchored variants first to avoid catching
  // "Post listing" or "Post photo" cards; then loosen.
  submitPost: [
    'role=button[name=/^\\s*(โพสต์|โพสต์เลย|เผยแพร่|แชร์โพสต์|Post|Publish|Share post)\\s*$/i]',
    '[role="dialog"] role=button[name=/^\\s*(โพสต์|Post|Publish)\\s*$/i]',
    // Last-ditch: any prominent button inside the composer dialog whose name
    // STARTS with โพสต์/Post (covers icon-suffixed labels FB sometimes ships).
    '[role="dialog"] role=button[name=/^(โพสต์|Post)\\b/i]',
  ],
  // "Sell Something" entry point — indicates the group supports Marketplace listings.
  // Confirmed Thai labels (2026): "ขายสินค้า" (most common), "ประกาศขาย",
  // "ลงประกาศขาย", "ขายของ", "ขายอะไรบางอย่าง", "เริ่มขาย", "ขายในกลุ่ม".
  listingButton: [
    'role=button[name=/ขายสินค้า|ประกาศขาย|ลงประกาศขาย|ขายของ|ขายอะไร|เริ่มขาย|ขายในกลุ่ม|Sell Something|Sell something|List for Sale|List something for sale/i]',
    'role=link[name=/ขายสินค้า|ประกาศขาย|ลงประกาศขาย|ขายของ|ขายอะไร|เริ่มขาย|ขายในกลุ่ม|Sell Something|Sell something|List for Sale/i]',
  ],
  // Listing form modal — category chooser. Confirmed Thai (2026):
  // "บ้านสำหรับขายหรือเช่า". Older/other variants:
  // "อสังหาริมทรัพย์ขายหรือให้เช่า", "ขายหรือเช่าอสังหา", "ที่อยู่อาศัยขาย/เช่า".
  // The umbrella regex matches "บ้าน|อสังหา|ที่อยู่อาศัย" + ANY arrangement of
  // ขาย/เช่า separated by /, |, "หรือ", or whitespace.
  listingCategoryPropertyForSaleOrRent: [
    'role=button[name=/(บ้าน|อสังหา|ที่อยู่อาศัย).*?(ขาย|เช่า)|((ขาย|เช่า).*?(บ้าน|อสังหา|ที่อยู่อาศัย))|Property for sale or rent/i]',
    'role=link[name=/(บ้าน|อสังหา|ที่อยู่อาศัย).*?(ขาย|เช่า)|((ขาย|เช่า).*?(บ้าน|อสังหา|ที่อยู่อาศัย))|Property for sale or rent/i]',
  ],
  // Comboboxes (click to open, then pick role=option)
  // Scoped to the dialog AND role=combobox specifically — the category chooser has
  // clickable "role=button" cards with the same name, which would false-match here.
  // Confirmed: "บ้านสำหรับขายหรือเช่า" is the actual combobox label too.
  listingKindCombobox: [
    '[role="dialog"] [role="combobox"][aria-label*="sale or rent" i]',
    '[role="dialog"] [role="combobox"][aria-label*="ขายหรือเช่า"]',
    '[role="dialog"] [role="combobox"][aria-label*="ขาย" i]',
    'role=combobox[name=/Property for sale or rent|(บ้าน|อสังหา|ที่อยู่อาศัย).*?(ขาย|เช่า)/i]',
  ],
  listingKindOptionSale: [
    'role=option[name=/^\\s*(For sale|Sale|ขาย|สำหรับขาย)\\s*$/i]',
  ],
  listingKindOptionRent: [
    'role=option[name=/^\\s*(For rent|Rent|ให้เช่า|สำหรับเช่า)\\s*$/i]',
  ],
  propertyTypeCombobox: [
    'role=combobox[name=/Property type|ประเภทอสังหา/i]',
    'role=button[name=/Property type|ประเภทอสังหา/i]',
  ],
  // Numeric & text inputs (role=textbox / role=spinbutton)
  listingBedroomsInput: [
    'role=spinbutton[name=/Number of bedrooms|จำนวนห้องนอน/i]',
    'role=textbox[name=/Number of bedrooms|จำนวนห้องนอน/i]',
  ],
  listingBathroomsInput: [
    'role=spinbutton[name=/Number of bathrooms|จำนวนห้องน้ำ/i]',
    'role=textbox[name=/Number of bathrooms|จำนวนห้องน้ำ/i]',
  ],
  listingPriceInput: [
    'role=spinbutton[name=/^\\s*(Price|ราคา)\\s*$/i]',
    'role=textbox[name=/^\\s*(Price|ราคา)\\s*$/i]',
  ],
  listingSqmInput: [
    'role=spinbutton[name=/Square metres|Square meters|ตารางเมตร|ขนาด.*ตรม/i]',
    'role=textbox[name=/Square metres|Square meters|ตารางเมตร|ขนาด.*ตรม/i]',
  ],
  // Location combobox + its suggestion listbox.
  // FB's location input is a role=combobox with aria-autocomplete="list" —
  // accessible name varies (sometimes blank, sometimes "Location", sometimes
  // "Property location"). The previous fallback chain caught Messenger's own
  // search-bar (aria-label="ค้นหา Messenger") because that input ALSO has
  // aria-autocomplete="list" inside its own role=dialog.
  //
  // We now: (a) scope every fallback to a dialog that contains a listing-form
  // marker like "ราคา" or "จำนวนห้อง" or "อสังหา", and (b) explicitly exclude
  // Messenger search via :not([aria-label*="Messenger" i]).
  listingLocationCombobox: [
    'role=combobox[name=/Location|Property location|ตำแหน่ง|ที่อยู่|สถานที่|ที่ตั้ง/i]',
    'role=textbox[name=/Location|Property location|ตำแหน่ง|ที่อยู่|สถานที่|ที่ตั้ง/i]',
    // Dialog scoped to the listing form (any of these Thai/English markers
    // pin it to the right modal — no false Messenger match):
    '[role="dialog"]:has-text("ราคา") input[aria-label*="location" i]:not([aria-label*="Messenger" i])',
    '[role="dialog"]:has-text("ราคา") input[aria-label*="ตำแหน่ง"]:not([aria-label*="Messenger" i])',
    '[role="dialog"]:has-text("ราคา") input[aria-label*="ที่ตั้ง"]:not([aria-label*="Messenger" i])',
    '[role="dialog"]:has-text("ราคา") input[aria-label*="ที่อยู่"]:not([aria-label*="Messenger" i])',
    '[role="dialog"]:has-text("ราคา") input[aria-label*="สถานที่"]:not([aria-label*="Messenger" i])',
    '[role="dialog"]:has-text("ราคา") input[placeholder*="Location" i]',
    '[role="dialog"]:has-text("ราคา") input[placeholder*="ตำแหน่ง"]',
    '[role="dialog"]:has-text("ราคา") input[placeholder*="ที่ตั้ง"]',
    '[role="dialog"]:has-text("ราคา") input[aria-autocomplete="list"]:not([aria-label*="Messenger" i])',
    '[role="dialog"]:has-text("ราคา") input[aria-autocomplete="both"]:not([aria-label*="Messenger" i])',
    '[role="dialog"]:has-text("ราคา") input[type="search"]:not([aria-label*="Messenger" i])',
    // Also pin via "จำนวนห้อง" or "อสังหา" markers in case "ราคา" is hidden
    // behind scroll on small viewports.
    '[role="dialog"]:has-text("จำนวนห้อง") input[aria-autocomplete="list"]:not([aria-label*="Messenger" i])',
    '[role="dialog"]:has-text("อสังหา") input[aria-autocomplete="list"]:not([aria-label*="Messenger" i])',
  ],
  listingLocationFirstOption: '[role="listbox"] >> role=option >> nth=0',
  // Description textbox. Confirmed Thai: "คำอธิบายอสังหาริมทรัพย์".
  listingDescriptionTextbox: [
    'role=textbox[name=/Property description|คำอธิบาย|รายละเอียด|Description/i]',
    '[role="dialog"] textarea',
  ],
  // Step navigation + submit
  listingNextButton: [
    'role=button[name=/^\\s*(Next|ถัดไป)\\s*$/i]',
  ],
  listingPublishButton: [
    'role=button[name=/^\\s*(Publish|Post|Post listing|Post it|Create listing|Share|โพสต์|ลงประกาศ|เผยแพร่|แชร์)\\s*$/i]',
  ],
  listingPublishedBanner: 'text=/โพสต์แล้ว|Listing published|Posted successfully|Posted to/i',
  // Share groups panel (step 2 after Next)
  shareGroupSearch: [
    'role=searchbox[name=/Search groups|ค้นหากลุ่ม/i]',
    '[role="dialog"] input[type="search"]',
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

/**
 * Selector candidates for a share-group row that can be clicked to toggle. FB's
 * multi-group share picker renders rows in several possible shapes, so we try:
 *   1. role=checkbox with the group name as accessible name
 *   2. role=menuitemcheckbox / role=option with the group name
 *   3. A label/text node containing the group name (click toggles the checkbox)
 */
export function shareGroupCheckboxByName(name: string): string[] {
  const escapedRe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedCss = name.replace(/"/g, '\\"');
  return [
    `role=checkbox[name=/${escapedRe}/i]`,
    `role=menuitemcheckbox[name=/${escapedRe}/i]`,
    `role=option[name=/${escapedRe}/i]`,
    `[role="dialog"] label:has-text("${escapedCss}")`,
    `[role="dialog"] [role="listitem"]:has-text("${escapedCss}")`,
    `[role="dialog"] div:has(> input[type="checkbox"]):has-text("${escapedCss}")`,
  ];
}

/**
 * Selector for a property-type option (Flat/House/Townhouse).
 */
export function propertyTypeOption(type: 'flat' | 'house' | 'townhouse'): string {
  const map = {
    flat: /^\s*(Flat|แฟลต|อพาร์ต|Apartment)\s*$/.source,
    house: /^\s*(House|บ้าน(เดี่ยว)?)\s*$/.source,
    townhouse: /^\s*(Townhouse|Town.?house|ทาวน์เฮาส์|ทาวน์โฮม)\s*$/.source,
  };
  return `role=option[name=/${map[type]}/i]`;
}
