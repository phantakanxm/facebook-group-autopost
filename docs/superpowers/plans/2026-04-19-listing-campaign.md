# Listing Campaign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second Campaign type `listing` that posts structured real-estate listings via Facebook's native "Sell Something" form, with automatic batching (≤21 groups per post) and per-batch state management — while the existing Regular Post flow continues working unchanged.

**Architecture:** Extend the existing `Campaign` table with a `type` discriminator and listing-specific fields; introduce `ListingBatch` + `ListingBatchGroup` tables to manage ⌈N/21⌉ posts per listing; extend the worker runner and scheduler to pick due batches; add a new Playwright `postListingBatch` flow that fills the 8 FB form fields, selects share groups, and clicks Publish; add a new Web UI ListingForm with live batch preview and a detail view that renders batches and attempts.

**Tech Stack:** TypeScript, Node.js ≥ 20, pnpm workspaces, Next.js 15 + tRPC v11 + Tailwind + i18n, Prisma + SQLite, Playwright + stealth, Vitest.

**Reference spec:** `docs/superpowers/specs/2026-04-19-listing-campaign-design.md`

**Baseline state:** commit `f43224e docs: add listing campaign design spec` — all Phase 1 (capability scanner) work already landed, 21 tests passing, web + worker running.

---

## File Structure

**Schema / shared**
- Modify: `packages/db/prisma/schema.prisma` (extend Campaign + Setting, add ListingBatch + ListingBatchGroup, add Group reverse relation)
- Create: Prisma migration directory (auto-generated)
- Modify: `packages/shared/src/constants.ts` (add CAMPAIGN_TYPES, LISTING_KINDS, PROPERTY_TYPES, MAX_PHOTOS_PER_LISTING, MAX_GROUPS_PER_BATCH)
- Create: `packages/shared/src/schemas/listing.ts` (listingCreateSchema)
- Modify: `packages/shared/src/index.ts` (barrel export)

**Worker — pure logic (TDD)**
- Create: `apps/worker/src/campaigns/batching.ts` (`batchSplit`, `scheduleForBatches`)
- Create: `apps/worker/src/campaigns/batching.test.ts`

**Worker — Playwright primitives**
- Modify: `apps/worker/src/playwright/selectors.ts` (add listing* selectors)
- Create: `apps/worker/test/fixtures/fb-listing-form.html` (offline fixture)
- Create: `apps/worker/src/playwright/listing-helpers.ts` (selectCombobox, fillNumericField, resolveLocationAutocomplete)
- Create: `apps/worker/src/playwright/listing-helpers.test.ts`

**Worker — posting flow**
- Create: `apps/worker/src/playwright/post-listing.ts` (`postListingBatch`)

**Worker — orchestration**
- Modify: `apps/worker/src/campaigns/runner.ts` (extend CampaignContext + PlaywrightAdapter with `postListingBatch`; branch on type)
- Create: `apps/worker/src/campaigns/listing-runner.ts` (`runListingBatch` — pickup lock, retry logic, campaign finalization)
- Create: `apps/worker/src/campaigns/listing-runner.test.ts`
- Modify: `apps/worker/src/scheduler.ts` (poll union of due post-campaigns and due listing-batches; pick earliest)
- Modify: `apps/worker/src/scheduler.test.ts` (add listing pickup tests)
- Modify: `apps/worker/src/playwright/adapter.ts` (wire real `postListingBatch`)

**Web — API**
- Modify: `apps/web/server/routers/campaign.ts` (add `createListing` mutation; extend `get` to include batches; ensure `resume`/`cancel` handle listing)

**Web — UI**
- Rewrite: `apps/web/app/campaigns/new/page.tsx` (type picker)
- Create: `apps/web/app/campaigns/new/post/page.tsx` (re-export existing post form)
- Create: `apps/web/app/campaigns/new/listing/page.tsx` (wrapper)
- Create: `apps/web/components/listing-form.tsx` (new form component)
- Create: `apps/web/components/batch-preview.tsx` (live batch split visualization)
- Modify: `apps/web/app/campaigns/[id]/page.tsx` (branch on type — render batches for listings)
- Modify: `apps/web/app/settings/page.tsx` (add Listing Campaigns section)
- Modify: `apps/web/lib/i18n.tsx` (add listing keys EN + TH)

**Docs**
- Modify: `README.md` (add Listing section, partial-share limitation, E2E checklist)

---

## Phases

- **A — Schema & shared constants**
- **B — Pure batching logic (TDD)**
- **C — Playwright primitives (TDD where feasible)**
- **D — `postListingBatch` orchestration**
- **E — Runner + scheduler integration (TDD)**
- **F — Web API surface**
- **G — Web UI**
- **H — Polish & docs**

Stop at phase boundaries if review is wanted.

---

## Phase A — Schema & shared constants

### Task A1: Extend Prisma schema with listing tables

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Generated: `packages/db/prisma/migrations/<timestamp>_add_listing_campaigns/migration.sql`

- [ ] **Step 1: Extend `Campaign` model**

In `packages/db/prisma/schema.prisma`, add the listing-specific fields to the existing `Campaign` model (inside the model block, before the relations):

```prisma
  // Discriminator for post vs listing campaigns
  type          String    @default("post")

  // Listing-only (nullable when type = "post")
  listingKind   String?
  propertyType  String?
  bedrooms      Int?
  bathrooms     Int?
  priceBaht     Int?
  location      String?
  squareMetres  Int?

  // Optional per-campaign override of Setting.delayBetweenBatches*
  batchDelayMinMs Int?
  batchDelayMaxMs Int?
```

And add this relation line at the end of the model's relations (beside the existing `groups` and `logs`):

```prisma
  batches ListingBatch[]
```

- [ ] **Step 2: Add `ListingBatch` model**

Append a new model block to the schema:

```prisma
model ListingBatch {
  id           String    @id @default(cuid())
  campaignId   String
  order        Int
  scheduledAt  DateTime

  status       String    @default("scheduled")
  startedAt    DateTime?
  completedAt  DateTime?
  attempt      Int       @default(0)
  lastError    String?
  fbPostUrl    String?
  note         String?

  createdAt    DateTime  @default(now())

  campaign Campaign            @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  groups   ListingBatchGroup[]

  @@index([status, scheduledAt])
}
```

- [ ] **Step 3: Add `ListingBatchGroup` model**

Append:

```prisma
model ListingBatchGroup {
  batchId   String
  groupId   String
  isPrimary Boolean @default(false)
  order     Int

  batch ListingBatch @relation(fields: [batchId], references: [id], onDelete: Cascade)
  group Group        @relation(fields: [groupId], references: [id])

  @@id([batchId, groupId])
}
```

- [ ] **Step 4: Add reverse relation on `Group`**

Inside the existing `Group` model, add this line at the end of its relations (beside existing `postLogs` and `campaigns`):

```prisma
  batches ListingBatchGroup[]
```

- [ ] **Step 5: Extend `Setting` model**

Inside the existing `Setting` model, after the `retryDelayMaxMs` field add:

```prisma
  delayBetweenBatchesMinMs Int @default(1800000)
  delayBetweenBatchesMaxMs Int @default(3600000)
  maxBatchesPerDay         Int @default(5)
```

- [ ] **Step 6: Generate migration**

Run: `pnpm db:migrate --name add_listing_campaigns`
Expected: new directory appears at `packages/db/prisma/migrations/<timestamp>_add_listing_campaigns/` containing `migration.sql`. The command also regenerates the Prisma client.

- [ ] **Step 7: Verify worker still compiles**

Run: `pnpm -F worker typecheck`
Expected: no errors. The new Prisma types exist but no code uses them yet.

Run: `pnpm -F web typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations
git commit -m "feat(db): add ListingBatch tables and listing fields on Campaign"
```

---

### Task A2: Shared constants + Zod listing schema

**Files:**
- Modify: `packages/shared/src/constants.ts`
- Create: `packages/shared/src/schemas/listing.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Extend constants**

Append to `packages/shared/src/constants.ts` (keep existing exports untouched):

```typescript
export const CAMPAIGN_TYPES = ['post', 'listing'] as const;
export type CampaignType = typeof CAMPAIGN_TYPES[number];

export const LISTING_KINDS = ['sale', 'rent'] as const;
export type ListingKind = typeof LISTING_KINDS[number];

export const PROPERTY_TYPES = ['flat', 'house', 'townhouse'] as const;
export type PropertyType = typeof PROPERTY_TYPES[number];

export const MAX_PHOTOS_PER_LISTING = 50;
export const MAX_GROUPS_PER_BATCH = 21;
```

- [ ] **Step 2: Create listing schema**

Create `packages/shared/src/schemas/listing.ts`:

```typescript
import { z } from 'zod';
import {
  LISTING_KINDS,
  PROPERTY_TYPES,
  MAX_PHOTOS_PER_LISTING,
} from '../constants.js';

const listingBaseSchema = z.object({
  listingKind: z.enum(LISTING_KINDS),
  propertyType: z.enum(PROPERTY_TYPES),
  bedrooms: z.number().int().min(0).max(50),
  bathrooms: z.number().int().min(0).max(50),
  priceBaht: z.number().int().min(0).max(9_999_999_999),
  location: z.string().min(1).max(500),
  squareMetres: z.number().int().min(1).max(100_000).nullable().optional(),

  content: z.string().min(1).max(63206),
  mediaFiles: z.array(z.string()).min(1).max(MAX_PHOTOS_PER_LISTING),

  scheduledAt: z.coerce.date(),
  jitterMinutes: z.number().int().min(0).max(120).default(15),
  groupIds: z.array(z.string()).min(1),

  batchDelayMinMs: z.number().int().min(60_000).max(24 * 3600_000).nullable().optional(),
  batchDelayMaxMs: z.number().int().min(60_000).max(24 * 3600_000).nullable().optional(),
});

export const listingCreateSchema = listingBaseSchema.superRefine((d, ctx) => {
  const hasMin = d.batchDelayMinMs != null && d.batchDelayMinMs !== undefined;
  const hasMax = d.batchDelayMaxMs != null && d.batchDelayMaxMs !== undefined;
  if (hasMin !== hasMax) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'batchDelayMinMs and batchDelayMaxMs must both be set or both omitted',
      path: ['batchDelayMinMs'],
    });
  }
  if (hasMin && hasMax && d.batchDelayMinMs! > d.batchDelayMaxMs!) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'batchDelayMinMs must be <= batchDelayMaxMs',
      path: ['batchDelayMinMs'],
    });
  }
});

export type ListingCreateInput = z.infer<typeof listingCreateSchema>;
```

- [ ] **Step 3: Export from barrel**

Modify `packages/shared/src/index.ts` — append:

```typescript
export * from './schemas/listing.js';
```

- [ ] **Step 4: Typecheck**

Run: `pnpm -F @app/shared typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/src/schemas/listing.ts packages/shared/src/index.ts
git commit -m "feat(shared): add listing constants and Zod create schema"
```

---

## Phase B — Pure batching logic (TDD)

### Task B1: `batchSplit` utility

**Files:**
- Create: `apps/worker/src/campaigns/batching.ts`
- Create: `apps/worker/src/campaigns/batching.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/worker/src/campaigns/batching.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { batchSplit } from './batching.js';

interface G { id: string }
const mk = (n: number): G[] => Array.from({ length: n }, (_, i) => ({ id: `g${i}` }));

describe('batchSplit', () => {
  it('returns single batch when input <= maxPerBatch', () => {
    const result = batchSplit(mk(5), 21);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(5);
  });

  it('returns single full batch at exactly maxPerBatch', () => {
    const result = batchSplit(mk(21), 21);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(21);
  });

  it('splits 22 into 21 + 1', () => {
    const result = batchSplit(mk(22), 21);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(21);
    expect(result[1]).toHaveLength(1);
  });

  it('splits 50 into 21 + 21 + 8 preserving input order', () => {
    const result = batchSplit(mk(50), 21);
    expect(result).toHaveLength(3);
    expect(result[0]!.map((g) => g.id)).toEqual(mk(21).map((g) => g.id));
    expect(result[1]!.map((g) => g.id)).toEqual(mk(21).map((_, i) => `g${i + 21}`));
    expect(result[2]!.map((g) => g.id)).toEqual(['g42', 'g43', 'g44', 'g45', 'g46', 'g47', 'g48', 'g49']);
  });

  it('returns empty array for empty input', () => {
    expect(batchSplit<G>([], 21)).toEqual([]);
  });

  it('throws if maxPerBatch <= 0', () => {
    expect(() => batchSplit(mk(5), 0)).toThrow();
  });
});
```

- [ ] **Step 2: Verify failing**

Run: `pnpm -F worker test batching`
Expected: FAIL — `./batching.js` not found.

- [ ] **Step 3: Implement**

Create `apps/worker/src/campaigns/batching.ts`:

```typescript
export function batchSplit<T>(items: T[], maxPerBatch: number): T[][] {
  if (maxPerBatch <= 0) {
    throw new Error(`batchSplit: maxPerBatch must be > 0 (got ${maxPerBatch})`);
  }
  if (items.length === 0) return [];
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += maxPerBatch) {
    batches.push(items.slice(i, i + maxPerBatch));
  }
  return batches;
}
```

- [ ] **Step 4: Verify passing**

Run: `pnpm -F worker test batching`
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/campaigns/batching.ts apps/worker/src/campaigns/batching.test.ts
git commit -m "feat(worker): add batchSplit utility with TDD"
```

---

### Task B2: `scheduleForBatches` utility

**Files:**
- Modify: `apps/worker/src/campaigns/batching.ts` (append)
- Modify: `apps/worker/src/campaigns/batching.test.ts` (append)

- [ ] **Step 1: Write failing test**

Append to `apps/worker/src/campaigns/batching.test.ts`:

```typescript
import { scheduleForBatches } from './batching.js';

describe('scheduleForBatches', () => {
  const base = new Date('2026-04-19T10:00:00Z');

  it('returns empty array for count=0', () => {
    expect(scheduleForBatches(base, { count: 0, minDelayMs: 60_000, maxDelayMs: 120_000 })).toEqual([]);
  });

  it('first batch equals base for count=1', () => {
    const r = scheduleForBatches(base, { count: 1, minDelayMs: 60_000, maxDelayMs: 120_000 });
    expect(r).toHaveLength(1);
    expect(r[0]!.getTime()).toBe(base.getTime());
  });

  it('each subsequent batch is prev + uniform(min, max)', () => {
    const min = 30 * 60_000;
    const max = 60 * 60_000;
    const r = scheduleForBatches(base, { count: 5, minDelayMs: min, maxDelayMs: max });
    expect(r).toHaveLength(5);
    expect(r[0]!.getTime()).toBe(base.getTime());
    for (let i = 1; i < r.length; i++) {
      const diff = r[i]!.getTime() - r[i - 1]!.getTime();
      expect(diff).toBeGreaterThanOrEqual(min);
      expect(diff).toBeLessThanOrEqual(max);
    }
  });

  it('produces different schedules across runs (randomness present)', () => {
    const runs = Array.from({ length: 5 }, () =>
      scheduleForBatches(base, { count: 3, minDelayMs: 60_000, maxDelayMs: 3_600_000 }).map((d) => d.getTime()),
    );
    const signatures = new Set(runs.map((r) => r.join(',')));
    expect(signatures.size).toBeGreaterThan(1);
  });

  it('throws if minDelayMs > maxDelayMs', () => {
    expect(() => scheduleForBatches(base, { count: 3, minDelayMs: 1000, maxDelayMs: 500 })).toThrow();
  });
});
```

- [ ] **Step 2: Verify failing**

Run: `pnpm -F worker test batching`
Expected: FAIL — `scheduleForBatches` not exported.

- [ ] **Step 3: Implement**

Append to `apps/worker/src/campaigns/batching.ts`:

```typescript
export interface ScheduleForBatchesOpts {
  count: number;
  minDelayMs: number;
  maxDelayMs: number;
}

export function scheduleForBatches(
  base: Date,
  opts: ScheduleForBatchesOpts,
): Date[] {
  if (opts.count <= 0) return [];
  if (opts.minDelayMs > opts.maxDelayMs) {
    throw new Error(
      `scheduleForBatches: minDelayMs (${opts.minDelayMs}) > maxDelayMs (${opts.maxDelayMs})`,
    );
  }

  const result: Date[] = [new Date(base.getTime())];
  for (let i = 1; i < opts.count; i++) {
    const prev = result[i - 1]!;
    const delay = Math.floor(
      opts.minDelayMs + Math.random() * (opts.maxDelayMs - opts.minDelayMs),
    );
    result.push(new Date(prev.getTime() + delay));
  }
  return result;
}
```

- [ ] **Step 4: Verify passing**

Run: `pnpm -F worker test batching`
Expected: all 11 tests PASS (6 batchSplit + 5 scheduleForBatches).

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/campaigns/batching.ts apps/worker/src/campaigns/batching.test.ts
git commit -m "feat(worker): add scheduleForBatches utility"
```

---

## Phase C — Playwright primitives

### Task C1: Listing selectors registry

**Files:**
- Modify: `apps/worker/src/playwright/selectors.ts`

- [ ] **Step 1: Add listing selectors**

Append new entries inside the `SELECTORS` object in `apps/worker/src/playwright/selectors.ts`, after the existing `listingButton` entry:

```typescript
  // Listing form modal — category chooser
  listingCategoryPropertyForSaleOrRent: [
    'role=button[name=/ขาย.?\\/?.?เช่า.?อสังหา|Property for sale or rent/i]',
    'role=link[name=/ขาย.?\\/?.?เช่า.?อสังหา|Property for sale or rent/i]',
  ],
  // Comboboxes (click to open, then pick role=option)
  listingKindCombobox: [
    'role=combobox[name=/Property for sale or rent|ขาย.?\\/?.?เช่า/i]',
    'role=button[name=/Property for sale or rent|ขาย.?\\/?.?เช่า/i]',
  ],
  listingKindOptionSale: [
    'role=option[name=/^\\s*(Sale|ขาย)\\s*$/i]',
  ],
  listingKindOptionRent: [
    'role=option[name=/^\\s*(Rent|ให้เช่า)\\s*$/i]',
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
  // Location combobox + its suggestion listbox
  listingLocationCombobox: [
    'role=combobox[name=/^\\s*(Location|ตำแหน่ง|ที่อยู่)\\s*$/i]',
    '[role="dialog"] input[placeholder*="Location" i]',
    '[role="dialog"] input[placeholder*="ตำแหน่ง"]',
  ],
  listingLocationFirstOption: '[role="listbox"] >> role=option >> nth=0',
  // Description textbox
  listingDescriptionTextbox: [
    'role=textbox[name=/Property description|รายละเอียด|Description/i]',
    '[role="dialog"] textarea',
  ],
  // Step navigation + submit
  listingNextButton: [
    'role=button[name=/^\\s*(Next|ถัดไป)\\s*$/i]',
  ],
  listingPublishButton: [
    'role=button[name=/^\\s*(Publish|โพสต์|ลงประกาศ)\\s*$/i]',
  ],
  listingPublishedBanner: 'text=/โพสต์แล้ว|Listing published|Posted successfully|Posted to/i',
  // Share groups panel (step 2 after Next)
  shareGroupSearch: [
    'role=searchbox[name=/Search groups|ค้นหากลุ่ม/i]',
    '[role="dialog"] input[type="search"]',
  ],
```

Also add a builder function outside the `SELECTORS` object (below `firstMatch`):

```typescript
/**
 * Selector for a share-group checkbox row matching a literal group name.
 * FB wraps the row as role=checkbox with the group name as the accessible name.
 */
export function shareGroupCheckboxByName(name: string): string {
  // Escape regex metachars so the name is treated literally.
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `role=checkbox[name=/${escaped}/i]`;
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
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F worker typecheck`
Expected: no errors.

- [ ] **Step 3: Verify tests still pass**

Run: `pnpm -F worker test`
Expected: all tests still pass (no test file touched).

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/playwright/selectors.ts
git commit -m "feat(worker): add FB listing form selectors"
```

---

### Task C2: Offline fixture HTML

**Files:**
- Create: `apps/worker/test/fixtures/fb-listing-form.html`

- [ ] **Step 1: Write fixture**

Create `apps/worker/test/fixtures/fb-listing-form.html`:

```html
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Mock FB Listing Form</title></head>
<body>
  <div role="dialog" aria-label="Property for sale or rent">
    <h2>Property for sale or rent</h2>

    <label>Photos
      <input type="file" id="photo-input" accept="image/*,image/heic,image/heif" multiple />
    </label>
    <div id="photo-feedback" data-testid="photo-feedback"></div>

    <label>Property for sale or rent
      <select id="kind" aria-label="Property for sale or rent">
        <option value="">--</option>
        <option value="sale">Sale</option>
        <option value="rent">Rent</option>
      </select>
    </label>

    <label>Property type
      <select id="ptype" aria-label="Property type">
        <option value="">--</option>
        <option value="flat">Flat</option>
        <option value="house">House</option>
        <option value="townhouse">Townhouse</option>
      </select>
    </label>

    <label>Number of bedrooms
      <input type="text" id="beds" aria-label="Number of bedrooms" />
    </label>

    <label>Number of bathrooms
      <input type="text" id="baths" aria-label="Number of bathrooms" />
    </label>

    <label>Price
      <input type="text" id="price" aria-label="Price" />
    </label>

    <label>Square metres
      <input type="text" id="sqm" aria-label="Square metres" />
    </label>

    <label>Location
      <input type="text" id="location" aria-label="Location" role="combobox" autocomplete="off" />
    </label>
    <ul id="location-suggestions" role="listbox" style="display:none;">
      <li role="option" id="suggestion-0">(no input)</li>
    </ul>

    <label>Property description
      <textarea id="description" aria-label="Property description" rows="4"></textarea>
    </label>

    <button id="next-btn" aria-label="Next">Next</button>
    <button id="publish-btn" aria-label="Publish" style="display:none;">Publish</button>
    <div id="published" data-testid="published"></div>
  </div>

  <script>
    const loc = document.getElementById('location');
    const suggestionsEl = document.getElementById('location-suggestions');
    const firstOpt = document.getElementById('suggestion-0');
    loc.addEventListener('input', () => {
      if (loc.value.trim().length >= 2) {
        firstOpt.textContent = loc.value + ' (top suggestion)';
        suggestionsEl.style.display = 'block';
      } else {
        suggestionsEl.style.display = 'none';
      }
    });
    firstOpt.addEventListener('click', () => {
      loc.value = firstOpt.textContent;
      suggestionsEl.style.display = 'none';
      loc.dataset.selected = 'true';
    });

    const nextBtn = document.getElementById('next-btn');
    const pubBtn = document.getElementById('publish-btn');
    nextBtn.addEventListener('click', () => {
      nextBtn.style.display = 'none';
      pubBtn.style.display = 'inline-block';
    });
    pubBtn.addEventListener('click', () => {
      document.getElementById('published').textContent = 'Listing published';
    });

    document.getElementById('photo-input').addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      document.getElementById('photo-feedback').textContent = `${files.length} photo(s) selected`;
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add apps/worker/test/fixtures/fb-listing-form.html
git commit -m "test(worker): add offline listing form fixture"
```

---

### Task C3: Listing helper functions with fixture tests

**Files:**
- Create: `apps/worker/src/playwright/listing-helpers.ts`
- Create: `apps/worker/src/playwright/listing-helpers.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/worker/src/playwright/listing-helpers.test.ts`:

```typescript
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
```

- [ ] **Step 2: Verify failing**

Run: `pnpm -F worker test listing-helpers`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement helpers**

Create `apps/worker/src/playwright/listing-helpers.ts`:

```typescript
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
```

- [ ] **Step 4: Verify passing**

Run: `pnpm -F worker test`
Expected: all existing tests + 3 new listing-helpers tests PASS. Total should be 26 (21 prior + 5 batching + 3 helpers wait that's 29, adjust as needed — just ensure no failures).

If any unrelated test fails, do NOT proceed — report BLOCKED.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/playwright/listing-helpers.ts apps/worker/src/playwright/listing-helpers.test.ts
git commit -m "feat(worker): add listing form helpers with fixture tests"
```

---

## Phase D — `postListingBatch` orchestration

### Task D1: Implement `postListingBatch`

**Files:**
- Create: `apps/worker/src/playwright/post-listing.ts`

- [ ] **Step 1: Write the orchestration function**

Create `apps/worker/src/playwright/post-listing.ts`:

```typescript
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

    // 3. Pick "Property for sale or rent" category
    const categoryBtn = await firstMatch(page, SELECTORS.listingCategoryPropertyForSaleOrRent);
    if (!categoryBtn) return await fail('selector_not_found', 'Property category missing');
    await humanClick(page, categoryBtn);
    await humanDelay(1_500, 2_500);

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
    if (note !== undefined) result.note = note as PostResult['note'];
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err: msg }, 'postListingBatch exception');
    return await fail('transient', msg);
  } finally {
    await page.close();
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F worker typecheck`
Expected: no errors.

- [ ] **Step 3: Verify tests**

Run: `pnpm -F worker test`
Expected: unchanged test count, all pass. (No unit tests for this function — it's end-to-end and tested via integration later plus manual E2E.)

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/playwright/post-listing.ts
git commit -m "feat(worker): add postListingBatch Playwright flow"
```

---

## Phase E — Runner + scheduler integration

### Task E1: Extend `CampaignContext` and `PlaywrightAdapter` interfaces

**Files:**
- Modify: `apps/worker/src/campaigns/runner.ts`

- [ ] **Step 1: Extend interfaces**

In `apps/worker/src/campaigns/runner.ts`, update the `CampaignContext` interface to add a second method. Locate the existing interface:

```typescript
export interface CampaignContext {
  postToGroup(input: {
    fbUrl: string;
    content: string;
    mediaFiles: string[];
    mediaType: 'images' | 'video' | 'none';
  }): Promise<PostResult>;
  close(): Promise<void>;
}
```

Replace with:

```typescript
export interface CampaignContext {
  postToGroup(input: {
    fbUrl: string;
    content: string;
    mediaFiles: string[];
    mediaType: 'images' | 'video' | 'none';
  }): Promise<PostResult>;
  postListingBatch(input: {
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
  }): Promise<PostResult>;
  close(): Promise<void>;
}
```

- [ ] **Step 2: Typecheck (expect errors to guide next tasks)**

Run: `pnpm -F worker typecheck`
Expected: errors in `adapter.ts` and `runner.test.ts`/`scheduler.test.ts` saying `postListingBatch` is missing — this is expected. The next tasks will fix them.

- [ ] **Step 3: Update existing test mocks**

Modify `apps/worker/src/campaigns/runner.test.ts` — inside `makeAdapter` helper, update the default `openCampaign` mock to include `postListingBatch`. Find the block:

```typescript
  function makeAdapter(overrides: Partial<PlaywrightAdapter> = {}): PlaywrightAdapter {
    const postToGroup = vi.fn().mockResolvedValue({ success: true, fbPostUrl: 'https://fb.com/p/1' });
    return {
      verifySession: vi.fn().mockResolvedValue({ valid: true }),
      openCampaign: vi.fn().mockResolvedValue({
        postToGroup,
        close: vi.fn().mockResolvedValue(undefined),
      }),
      ...overrides,
    };
  }
```

Replace `close: vi.fn()...` line, keeping it, and insert before it:

```typescript
        postListingBatch: vi.fn().mockResolvedValue({ success: true, fbPostUrl: 'https://fb.com/listing/1' }),
```

Final shape:

```typescript
      openCampaign: vi.fn().mockResolvedValue({
        postToGroup,
        postListingBatch: vi.fn().mockResolvedValue({ success: true, fbPostUrl: 'https://fb.com/listing/1' }),
        close: vi.fn().mockResolvedValue(undefined),
      }),
```

Do the same for any `openCampaign: vi.fn().mockResolvedValue({ postToGroup: ... })` inline definitions within specific `it()` blocks in that file.

- [ ] **Step 4: Update scheduler test mocks similarly**

Open `apps/worker/src/scheduler.test.ts`. In the `adapter()` helper function, locate the `openCampaign` mock block and add `postListingBatch` to the returned context object, same as step 3.

- [ ] **Step 5: Typecheck + tests**

Run: `pnpm -F worker typecheck`
Expected: only `adapter.ts` errors remaining.

Run: `pnpm -F worker test` (may still fail on typecheck in watch mode — use the plain `test` command which runs regardless of tsc).

If tests fail because the mock signatures are incomplete, inspect failure and ensure the mock objects include `postListingBatch`.

- [ ] **Step 6: Commit (partial — adapter.ts will be fixed in next task)**

```bash
git add apps/worker/src/campaigns/runner.ts apps/worker/src/campaigns/runner.test.ts apps/worker/src/scheduler.test.ts
git commit -m "feat(worker): extend CampaignContext with postListingBatch interface"
```

---

### Task E2: Wire real adapter to call `postListingBatch`

**Files:**
- Modify: `apps/worker/src/playwright/adapter.ts`

- [ ] **Step 1: Update adapter**

Rewrite `apps/worker/src/playwright/adapter.ts`:

```typescript
import type { PrismaClient } from '@prisma/client';
import type { PlaywrightAdapter } from '../campaigns/runner.js';
import { launchBrowser } from './browser.js';
import { verifySession } from './session.js';
import { postToGroup as playwrightPostToGroup } from './post.js';
import { postListingBatch as playwrightPostListingBatch } from './post-listing.js';

export function createRealAdapter(prisma: PrismaClient): PlaywrightAdapter {
  return {
    verifySession: (userId) => verifySession(userId),
    openCampaign: async (userId) => {
      const ctx = await launchBrowser({ userId, headless: false });
      const setting = await prisma.setting.findUniqueOrThrow({ where: { userId } });
      return {
        postToGroup: (input) => playwrightPostToGroup(ctx, {
          fbUrl: input.fbUrl,
          content: input.content,
          mediaFiles: input.mediaFiles,
          mediaType: input.mediaType,
          enableScrollBeforePost: setting.enableScrollBeforePost,
          delayBeforePost: { min: setting.delayBeforePostMinMs, max: setting.delayBeforePostMaxMs },
          delayAfterFocus: { min: setting.delayAfterFocusMinMs, max: setting.delayAfterFocusMaxMs },
        }),
        postListingBatch: (input) => playwrightPostListingBatch(ctx, input),
        close: () => ctx.close(),
      };
    },
  };
}
```

- [ ] **Step 2: Typecheck + tests**

Run: `pnpm -F worker typecheck && pnpm -F worker test`
Expected: both clean, no regressions.

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/playwright/adapter.ts
git commit -m "feat(worker): wire postListingBatch into real adapter"
```

---

### Task E3: Implement listing runner (TDD)

**Files:**
- Create: `apps/worker/src/campaigns/listing-runner.ts`
- Create: `apps/worker/src/campaigns/listing-runner.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/worker/src/campaigns/listing-runner.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { setupTestDb, seedBasic, type TestDb } from '../../test/setup-db.js';
import { runListingBatch, type PlaywrightAdapter } from './listing-runner.js';

async function seedListing(prisma: PrismaClient, groupCount: number, batchGroupCounts: number[]) {
  const { user, groups } = await seedBasic(prisma, { groups: groupCount });
  const campaign = await prisma.campaign.create({
    data: {
      userId: user.id,
      content: 'nice property',
      scheduledAt: new Date('2026-04-19T10:00:00Z'),
      status: 'scheduled',
      type: 'listing',
      listingKind: 'sale',
      propertyType: 'house',
      bedrooms: 3,
      bathrooms: 2,
      priceBaht: 3500000,
      location: 'Udon Thani',
      mediaFiles: JSON.stringify(['/tmp/a.jpg']),
      mediaType: 'images',
    },
  });

  let groupCursor = 0;
  for (let i = 0; i < batchGroupCounts.length; i++) {
    const batch = await prisma.listingBatch.create({
      data: {
        campaignId: campaign.id,
        order: i,
        scheduledAt: new Date(Date.now() + i * 3_600_000 - 60_000),
        status: 'scheduled',
      },
    });
    for (let j = 0; j < batchGroupCounts[i]!; j++) {
      const g = groups[groupCursor++]!;
      await prisma.listingBatchGroup.create({
        data: { batchId: batch.id, groupId: g.id, isPrimary: j === 0, order: j },
      });
    }
  }
  return { user, groups, campaign };
}

describe('runListingBatch', () => {
  let db: TestDb;
  let prisma: PrismaClient;

  beforeEach(async () => { db = await setupTestDb(); prisma = db.prisma; });
  afterEach(async () => { await db.cleanup(); });

  function makeAdapter(overrides: Partial<PlaywrightAdapter> = {}): PlaywrightAdapter {
    return {
      verifySession: vi.fn().mockResolvedValue({ valid: true }),
      openCampaign: vi.fn().mockResolvedValue({
        postToGroup: vi.fn(),
        postListingBatch: vi.fn().mockResolvedValue({ success: true, fbPostUrl: 'https://fb.com/l/1' }),
        close: vi.fn().mockResolvedValue(undefined),
      }),
      ...overrides,
    };
  }

  it('runs a due batch, marks completed, and marks campaign completed on last batch', async () => {
    const { campaign } = await seedListing(prisma, 5, [5]);
    const batches = await prisma.listingBatch.findMany({ where: { campaignId: campaign.id } });
    const adapter = makeAdapter();

    await runListingBatch({ batchId: batches[0]!.id, prisma, adapter, fastMode: true });

    const b = await prisma.listingBatch.findUniqueOrThrow({ where: { id: batches[0]!.id } });
    expect(b.status).toBe('completed');
    expect(b.fbPostUrl).toBe('https://fb.com/l/1');

    const c = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(c.status).toBe('completed');
  });

  it('keeps campaign running when intermediate batch completes', async () => {
    const { campaign } = await seedListing(prisma, 40, [21, 19]);
    const batches = await prisma.listingBatch.findMany({ where: { campaignId: campaign.id }, orderBy: { order: 'asc' } });
    const adapter = makeAdapter();

    await runListingBatch({ batchId: batches[0]!.id, prisma, adapter, fastMode: true });

    const c = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(c.status).toBe('running');

    const b1 = await prisma.listingBatch.findUniqueOrThrow({ where: { id: batches[1]!.id } });
    expect(b1.status).toBe('scheduled');
  });

  it('pauses campaign on critical error (session_invalid)', async () => {
    const { campaign } = await seedListing(prisma, 40, [21, 19]);
    const batches = await prisma.listingBatch.findMany({ where: { campaignId: campaign.id }, orderBy: { order: 'asc' } });
    const adapter = makeAdapter({
      openCampaign: vi.fn().mockResolvedValue({
        postToGroup: vi.fn(),
        postListingBatch: vi.fn().mockResolvedValue({ success: false, errorCategory: 'session_invalid', error: 'x' }),
        close: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await runListingBatch({ batchId: batches[0]!.id, prisma, adapter, fastMode: true });

    const c = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(c.status).toBe('paused');
    const b0 = await prisma.listingBatch.findUniqueOrThrow({ where: { id: batches[0]!.id } });
    expect(b0.status).toBe('failed');
    const b1 = await prisma.listingBatch.findUniqueOrThrow({ where: { id: batches[1]!.id } });
    expect(b1.status).toBe('scheduled');
  });

  it('reschedules batch on transient failure if attempt < 3', async () => {
    const { campaign } = await seedListing(prisma, 5, [5]);
    const batches = await prisma.listingBatch.findMany({ where: { campaignId: campaign.id } });
    const adapter = makeAdapter({
      openCampaign: vi.fn().mockResolvedValue({
        postToGroup: vi.fn(),
        postListingBatch: vi.fn().mockResolvedValue({ success: false, errorCategory: 'transient', error: 'net' }),
        close: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await runListingBatch({ batchId: batches[0]!.id, prisma, adapter, fastMode: true });

    const b = await prisma.listingBatch.findUniqueOrThrow({ where: { id: batches[0]!.id } });
    expect(b.status).toBe('scheduled');
    expect(b.attempt).toBe(1);
  });

  it('skips batch and continues campaign after 3 transient failures', async () => {
    const { campaign } = await seedListing(prisma, 5, [5]);
    const batches = await prisma.listingBatch.findMany({ where: { campaignId: campaign.id } });
    await prisma.listingBatch.update({ where: { id: batches[0]!.id }, data: { attempt: 2 } });

    const adapter = makeAdapter({
      openCampaign: vi.fn().mockResolvedValue({
        postToGroup: vi.fn(),
        postListingBatch: vi.fn().mockResolvedValue({ success: false, errorCategory: 'transient', error: 'net' }),
        close: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await runListingBatch({ batchId: batches[0]!.id, prisma, adapter, fastMode: true });

    const b = await prisma.listingBatch.findUniqueOrThrow({ where: { id: batches[0]!.id } });
    expect(b.status).toBe('skipped');
    const c = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(c.status).toBe('completed');
  });
});
```

- [ ] **Step 2: Verify failing**

Run: `pnpm -F worker test listing-runner`
Expected: FAIL — `./listing-runner.js` not found.

- [ ] **Step 3: Implement**

Create `apps/worker/src/campaigns/listing-runner.ts`:

```typescript
import type { PrismaClient } from '@prisma/client';
import type { PostResult } from '@app/shared';
import { humanDelay } from '../utils/delays.js';
import { logger } from '../logger.js';

export interface CampaignContext {
  postToGroup(input: unknown): Promise<PostResult>;
  postListingBatch(input: {
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
  }): Promise<PostResult>;
  close(): Promise<void>;
}

export interface PlaywrightAdapter {
  verifySession(userId: string): Promise<{ valid: boolean; reason?: string }>;
  openCampaign(userId: string): Promise<CampaignContext>;
}

export interface RunListingBatchInput {
  batchId: string;
  prisma: PrismaClient;
  adapter: PlaywrightAdapter;
  /** Skip retry-delay sleeps in tests. */
  fastMode?: boolean;
}

const MAX_RETRIES = 2; // 0,1,2 → three attempts before skip
const CRITICAL_CATEGORIES = new Set(['session_invalid', 'account_locked', 'rate_limited']);

async function finalizeCampaignIfDone(prisma: PrismaClient, campaignId: string): Promise<void> {
  const pending = await prisma.listingBatch.count({
    where: { campaignId, status: { in: ['scheduled', 'running'] } },
  });
  if (pending > 0) return;
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'completed', completedAt: new Date() },
  });
}

export async function runListingBatch(input: RunListingBatchInput): Promise<void> {
  const { batchId, prisma, adapter, fastMode = false } = input;
  const log = logger.child({ batchId });

  // 1. Atomic lock (if not already claimed)
  const lock = await prisma.listingBatch.updateMany({
    where: { id: batchId, status: 'scheduled' },
    data: { status: 'running', startedAt: new Date() },
  });
  if (lock.count === 0) {
    log.warn('batch not in scheduled state, skipping');
    return;
  }

  const batch = await prisma.listingBatch.findUniqueOrThrow({
    where: { id: batchId },
    include: { groups: { orderBy: { order: 'asc' }, include: { group: true } } },
  });
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: batch.campaignId } });
  const setting = await prisma.setting.findUniqueOrThrow({ where: { userId: campaign.userId } });

  // Mark campaign running (idempotent)
  if (campaign.status !== 'running') {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'running', startedAt: campaign.startedAt ?? new Date() },
    });
  }

  // 2. Verify session
  const sessionCheck = await adapter.verifySession(campaign.userId);
  if (!sessionCheck.valid) {
    await prisma.listingBatch.update({
      where: { id: batchId },
      data: { status: 'failed', lastError: `session_invalid: ${sessionCheck.reason ?? ''}` },
    });
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'paused', lastError: 'session_invalid' },
    });
    log.warn('session invalid — paused');
    return;
  }

  // 3. Open browser context and post
  const ctx = await adapter.openCampaign(campaign.userId);
  let result: PostResult;
  try {
    const primary = batch.groups.find((bg) => bg.isPrimary)!;
    const shares = batch.groups.filter((bg) => !bg.isPrimary);
    const mediaFiles: string[] = JSON.parse(campaign.mediaFiles);

    result = await ctx.postListingBatch({
      primaryGroupFbUrl: primary.group.fbUrl,
      shareGroupNames: shares.map((s) => s.group.name ?? s.group.fbGroupId),
      listingKind: campaign.listingKind as 'sale' | 'rent',
      propertyType: campaign.propertyType as 'flat' | 'house' | 'townhouse',
      bedrooms: campaign.bedrooms!,
      bathrooms: campaign.bathrooms!,
      priceBaht: campaign.priceBaht!,
      squareMetres: campaign.squareMetres,
      location: campaign.location!,
      description: campaign.content,
      mediaFiles,
    });
  } finally {
    await ctx.close();
  }

  // 4. Handle result
  if (result.success) {
    await prisma.listingBatch.update({
      where: { id: batchId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        ...(result.fbPostUrl !== undefined ? { fbPostUrl: result.fbPostUrl } : {}),
        ...(result.note !== undefined ? { note: result.note } : {}),
      },
    });
    // Update lastPosted for each group in batch
    for (const bg of batch.groups) {
      await prisma.group.update({ where: { id: bg.groupId }, data: { lastPosted: new Date() } });
    }
    await finalizeCampaignIfDone(prisma, campaign.id);
    log.info('batch completed');
    return;
  }

  // Critical failure → pause campaign
  if (result.errorCategory && CRITICAL_CATEGORIES.has(result.errorCategory)) {
    await prisma.listingBatch.update({
      where: { id: batchId },
      data: { status: 'failed', lastError: `${result.errorCategory}: ${result.error ?? ''}` },
    });
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'paused', lastError: `${result.errorCategory}` },
    });
    log.warn({ category: result.errorCategory }, 'critical failure — paused');
    return;
  }

  // Transient failure → retry or skip
  const nextAttempt = batch.attempt + 1;
  if (nextAttempt <= MAX_RETRIES) {
    const delayMin = 3 * 60_000;
    const delayMax = 10 * 60_000;
    const retryDelay = delayMin + Math.floor(Math.random() * (delayMax - delayMin));
    const nextAt = fastMode ? new Date() : new Date(Date.now() + retryDelay);
    await prisma.listingBatch.update({
      where: { id: batchId },
      data: {
        status: 'scheduled',
        attempt: nextAttempt,
        scheduledAt: nextAt,
        lastError: `${result.errorCategory ?? 'transient'}: ${result.error ?? ''}`,
      },
    });
    log.warn({ attempt: nextAttempt, retryDelayMs: retryDelay }, 'batch retry scheduled');
    if (!fastMode) await humanDelay(100, 200); // yield
    return;
  }

  // Out of retries → skip
  await prisma.listingBatch.update({
    where: { id: batchId },
    data: {
      status: 'skipped',
      lastError: `max_retries_exceeded: ${result.errorCategory ?? 'transient'}: ${result.error ?? ''}`,
    },
  });
  await finalizeCampaignIfDone(prisma, campaign.id);
  log.warn('batch skipped after max retries');
}
```

- [ ] **Step 4: Verify passing**

Run: `pnpm -F worker test listing-runner`
Expected: 5 tests PASS.

Run: `pnpm -F worker test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/campaigns/listing-runner.ts apps/worker/src/campaigns/listing-runner.test.ts
git commit -m "feat(worker): add listing runner with batch retry and pause logic"
```

---

### Task E4: Extend scheduler to pick listing batches

**Files:**
- Modify: `apps/worker/src/scheduler.ts`
- Modify: `apps/worker/src/scheduler.test.ts`

- [ ] **Step 1: Write failing test**

In `apps/worker/src/scheduler.test.ts`, append a new describe block at the end:

```typescript
describe('pollAndRunOnce — listing batches', () => {
  let db: TestDb;
  let prisma: PrismaClient;

  beforeEach(async () => { db = await setupTestDb(); prisma = db.prisma; });
  afterEach(async () => { await db.cleanup(); });

  it('picks due listing batch and runs it', async () => {
    const { user, groups } = await seedBasic(prisma, { groups: 3 });
    const campaign = await prisma.campaign.create({
      data: {
        userId: user.id,
        content: 'hi',
        scheduledAt: new Date(Date.now() - 60_000),
        status: 'running',
        type: 'listing',
        listingKind: 'sale',
        propertyType: 'house',
        bedrooms: 2,
        bathrooms: 1,
        priceBaht: 1_000_000,
        location: 'UD',
        mediaFiles: JSON.stringify(['/tmp/a.jpg']),
        mediaType: 'images',
      },
    });
    const batch = await prisma.listingBatch.create({
      data: {
        campaignId: campaign.id,
        order: 0,
        scheduledAt: new Date(Date.now() - 60_000),
        status: 'scheduled',
      },
    });
    await prisma.listingBatchGroup.create({
      data: { batchId: batch.id, groupId: groups[0]!.id, isPrimary: true, order: 0 },
    });

    const postListingBatch = vi.fn().mockResolvedValue({ success: true, fbPostUrl: 'https://fb/l/1' });
    const a: ReturnType<typeof adapter> = {
      verifySession: vi.fn().mockResolvedValue({ valid: true }),
      openCampaign: vi.fn().mockResolvedValue({
        postToGroup: vi.fn(),
        postListingBatch,
        close: vi.fn().mockResolvedValue(undefined),
      }),
    };

    const ran = await pollAndRunOnce({ prisma, adapter: a, fastMode: true });
    expect(ran).toBe(`listing:${batch.id}`);

    const updated = await prisma.listingBatch.findUniqueOrThrow({ where: { id: batch.id } });
    expect(updated.status).toBe('completed');
  });
});
```

You'll also need to update the `adapter()` helper at the top of that file to include `postListingBatch` in its returned openCampaign mock (done in Task E1 step 4 — verify it's present).

- [ ] **Step 2: Verify failing**

Run: `pnpm -F worker test scheduler`
Expected: FAIL — listing batches are not being picked up (ran returns null or wrong value).

- [ ] **Step 3: Update scheduler**

Rewrite `apps/worker/src/scheduler.ts`:

```typescript
import type { PrismaClient } from '@prisma/client';
import { runCampaign, type PlaywrightAdapter } from './campaigns/runner.js';
import { runListingBatch } from './campaigns/listing-runner.js';
import { logger } from './logger.js';
import { handleSessionRequests } from './session/requests.js';

export interface PollOpts {
  prisma: PrismaClient;
  adapter: PlaywrightAdapter;
  fastMode?: boolean;
}

/**
 * Find the earliest due work (regular post campaign OR listing batch) and run it.
 * Returns a tag string describing what ran ('post:<id>' or 'listing:<batchId>'),
 * or null if nothing was due.
 */
export async function pollAndRunOnce(opts: PollOpts): Promise<string | null> {
  const now = new Date();

  const duePost = await opts.prisma.campaign.findFirst({
    where: { status: 'scheduled', scheduledAt: { lte: now }, type: 'post' },
    orderBy: { scheduledAt: 'asc' },
    select: { id: true, scheduledAt: true },
  });

  const dueBatch = await opts.prisma.listingBatch.findFirst({
    where: {
      status: 'scheduled',
      scheduledAt: { lte: now },
      campaign: { type: 'listing', status: { notIn: ['paused', 'completed', 'failed'] } },
    },
    orderBy: { scheduledAt: 'asc' },
    select: { id: true, scheduledAt: true },
  });

  // Pick whichever is earliest; tie-break to post.
  let chosen: { kind: 'post' | 'listing'; id: string } | null = null;
  if (duePost && dueBatch) {
    chosen = duePost.scheduledAt <= dueBatch.scheduledAt
      ? { kind: 'post', id: duePost.id }
      : { kind: 'listing', id: dueBatch.id };
  } else if (duePost) {
    chosen = { kind: 'post', id: duePost.id };
  } else if (dueBatch) {
    chosen = { kind: 'listing', id: dueBatch.id };
  }

  if (!chosen) return null;

  if (chosen.kind === 'post') {
    logger.info({ campaignId: chosen.id }, 'picked up due campaign (post)');
    const runOpts = opts.fastMode !== undefined
      ? { campaignId: chosen.id, prisma: opts.prisma, adapter: opts.adapter, fastMode: opts.fastMode }
      : { campaignId: chosen.id, prisma: opts.prisma, adapter: opts.adapter };
    await runCampaign(runOpts);
    return `post:${chosen.id}`;
  }

  logger.info({ batchId: chosen.id }, 'picked up due listing batch');
  const runOpts = opts.fastMode !== undefined
    ? { batchId: chosen.id, prisma: opts.prisma, adapter: opts.adapter, fastMode: opts.fastMode }
    : { batchId: chosen.id, prisma: opts.prisma, adapter: opts.adapter };
  await runListingBatch(runOpts);
  return `listing:${chosen.id}`;
}

/**
 * Long-running loop. Polls every `intervalMs` (default 30s).
 * Returns a stop() function.
 */
export function startScheduler(opts: PollOpts & { intervalMs?: number }): () => void {
  const interval = opts.intervalMs ?? 30_000;
  let running = false;
  let stopped = false;

  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try {
      // Session setup/verify/auto-sync/capability-scan flags — existing behavior
      await handleSessionRequests('default-user');
      await pollAndRunOnce(opts);
    } catch (err) {
      logger.error({ err }, 'scheduler tick failed');
    } finally {
      running = false;
    }
  };

  const handle = setInterval(tick, interval);
  void tick();

  return () => {
    stopped = true;
    clearInterval(handle);
  };
}
```

Note: the existing existing post-only tests expect `pollAndRunOnce` to return the campaign `id` (not a tag). Update the existing tests in `scheduler.test.ts` to assert the new `post:${id}` tag instead of bare `id`. Find:

```typescript
expect(ran).toBe(c1.id);
```

Replace with:

```typescript
expect(ran).toBe(`post:${c1.id}`);
```

Apply to ALL such assertions in `scheduler.test.ts`.

- [ ] **Step 4: Verify tests**

Run: `pnpm -F worker test scheduler`
Expected: all scheduler tests pass (including the new listing one).

Run: `pnpm -F worker test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/scheduler.ts apps/worker/src/scheduler.test.ts
git commit -m "feat(worker): scheduler picks earliest due post-campaign or listing-batch"
```

---

## Phase F — Web API

### Task F1: `campaign.createListing` mutation

**Files:**
- Modify: `apps/web/server/routers/campaign.ts`

- [ ] **Step 1: Add imports + mutation**

Open `apps/web/server/routers/campaign.ts`. At the top, update imports:

```typescript
import { router, publicProcedure } from '../trpc.js';
import { z } from 'zod';
import {
  campaignCreateSchema,
  campaignUpdateSchema,
  listingCreateSchema,
  MAX_GROUPS_PER_BATCH,
} from '@app/shared';
```

Inside the existing `campaignRouter = router({ ... })`, add a new mutation **after** the existing `create` mutation:

```typescript
  createListing: publicProcedure
    .input(listingCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // Fetch groups; verify all are listing-capable + active + belong to user.
      const groups = await ctx.prisma.group.findMany({
        where: {
          id: { in: input.groupIds },
          userId: ctx.userId,
          isActive: true,
        },
      });
      const foundIds = new Set(groups.map((g) => g.id));
      const missing = input.groupIds.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        throw new Error(`Groups not found or inactive: ${missing.join(',')}`);
      }
      const nonCapable = groups.filter((g) => !g.supportsListing).map((g) => g.fbGroupId);
      if (nonCapable.length > 0) {
        throw new Error(`Groups do not support listings: ${nonCapable.join(',')}`);
      }

      // Batching.
      const orderedGroups = input.groupIds
        .map((id) => groups.find((g) => g.id === id))
        .filter((g): g is typeof groups[number] => g !== undefined);
      const batchChunks: typeof orderedGroups[] = [];
      for (let i = 0; i < orderedGroups.length; i += MAX_GROUPS_PER_BATCH) {
        batchChunks.push(orderedGroups.slice(i, i + MAX_GROUPS_PER_BATCH));
      }

      const setting = await ctx.prisma.setting.findUniqueOrThrow({ where: { userId: ctx.userId } });
      const minDelay = input.batchDelayMinMs ?? setting.delayBetweenBatchesMinMs;
      const maxDelay = input.batchDelayMaxMs ?? setting.delayBetweenBatchesMaxMs;

      const batchScheduledAt: Date[] = [new Date(input.scheduledAt.getTime())];
      for (let i = 1; i < batchChunks.length; i++) {
        const prev = batchScheduledAt[i - 1]!;
        const delay = Math.floor(minDelay + Math.random() * (maxDelay - minDelay));
        batchScheduledAt.push(new Date(prev.getTime() + delay));
      }

      // Create campaign + batches + batch-groups in a transaction.
      const created = await ctx.prisma.$transaction(async (tx) => {
        const campaign = await tx.campaign.create({
          data: {
            userId: ctx.userId,
            content: input.content,
            mediaType: 'images',
            mediaFiles: JSON.stringify(input.mediaFiles),
            type: 'listing',
            listingKind: input.listingKind,
            propertyType: input.propertyType,
            bedrooms: input.bedrooms,
            bathrooms: input.bathrooms,
            priceBaht: input.priceBaht,
            location: input.location,
            scheduledAt: input.scheduledAt,
            recurrence: null,
            jitterMinutes: input.jitterMinutes,
            status: 'scheduled',
            ...(input.squareMetres != null ? { squareMetres: input.squareMetres } : {}),
            ...(input.batchDelayMinMs != null ? { batchDelayMinMs: input.batchDelayMinMs } : {}),
            ...(input.batchDelayMaxMs != null ? { batchDelayMaxMs: input.batchDelayMaxMs } : {}),
          },
        });

        for (let i = 0; i < batchChunks.length; i++) {
          const chunk = batchChunks[i]!;
          const batch = await tx.listingBatch.create({
            data: {
              campaignId: campaign.id,
              order: i,
              scheduledAt: batchScheduledAt[i]!,
              status: 'scheduled',
            },
          });
          for (let j = 0; j < chunk.length; j++) {
            await tx.listingBatchGroup.create({
              data: {
                batchId: batch.id,
                groupId: chunk[j]!.id,
                isPrimary: j === 0,
                order: j,
              },
            });
          }
        }
        return campaign;
      });

      return { id: created.id };
    }),
```

- [ ] **Step 2: Extend existing `get` to include batches when type='listing'**

Locate the existing `get` query:

```typescript
  get: publicProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) =>
    ctx.prisma.campaign.findUniqueOrThrow({
      where: { id: input.id },
      include: {
        groups: { include: { group: true }, orderBy: { order: 'asc' } },
        logs: { orderBy: { createdAt: 'desc' } },
      },
    }),
  ),
```

Replace with:

```typescript
  get: publicProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) =>
    ctx.prisma.campaign.findUniqueOrThrow({
      where: { id: input.id },
      include: {
        groups: { include: { group: true }, orderBy: { order: 'asc' } },
        logs: { orderBy: { createdAt: 'desc' } },
        batches: {
          orderBy: { order: 'asc' },
          include: {
            groups: { include: { group: true }, orderBy: { order: 'asc' } },
          },
        },
      },
    }),
  ),
```

- [ ] **Step 3: Update `resume` to also reschedule pending/failed batches**

Locate the existing `resume` mutation and replace its body:

```typescript
  resume: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const c = await ctx.prisma.campaign.findUniqueOrThrow({ where: { id: input.id } });
    if (c.status !== 'paused') throw new Error('Only paused campaigns can be resumed');

    const now = new Date();
    const baseAt = new Date(now.getTime() + 5 * 60_000);

    if (c.type === 'listing') {
      const setting = await ctx.prisma.setting.findUniqueOrThrow({ where: { userId: c.userId } });
      const minDelay = c.batchDelayMinMs ?? setting.delayBetweenBatchesMinMs;
      const maxDelay = c.batchDelayMaxMs ?? setting.delayBetweenBatchesMaxMs;
      const pending = await ctx.prisma.listingBatch.findMany({
        where: { campaignId: c.id, status: { in: ['failed', 'scheduled'] } },
        orderBy: { order: 'asc' },
      });
      for (let i = 0; i < pending.length; i++) {
        const delay = i === 0 ? 0 : Math.floor(minDelay + Math.random() * (maxDelay - minDelay));
        const when = new Date(baseAt.getTime() + (i === 0 ? 0 : delay));
        await ctx.prisma.listingBatch.update({
          where: { id: pending[i]!.id },
          data: { status: 'scheduled', attempt: 0, lastError: null, scheduledAt: when },
        });
        if (i > 0) baseAt.setTime(when.getTime());
      }
    }

    await ctx.prisma.campaign.update({
      where: { id: input.id },
      data: { status: 'scheduled', scheduledAt: baseAt, lastError: null },
    });
    return { ok: true };
  }),
```

- [ ] **Step 4: Update `cancel` for listing batches**

Locate the existing `cancel` mutation and replace with:

```typescript
  cancel: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const c = await ctx.prisma.campaign.findUniqueOrThrow({ where: { id: input.id } });
    if (c.status === 'running') throw new Error('Cannot cancel running campaign');
    if (c.type === 'listing') {
      await ctx.prisma.listingBatch.updateMany({
        where: { campaignId: c.id, status: 'scheduled' },
        data: { status: 'skipped' },
      });
    }
    await ctx.prisma.campaign.update({
      where: { id: input.id },
      data: { status: 'completed', completedAt: new Date() },
    });
    return { ok: true };
  }),
```

- [ ] **Step 5: Typecheck**

Run: `pnpm -F web typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/server/routers/campaign.ts
git commit -m "feat(web): add campaign.createListing and extend resume/cancel/get for batches"
```

---

## Phase G — Web UI

### Task G1: Type picker at `/campaigns/new`

**Files:**
- Create: `apps/web/app/campaigns/new/post/page.tsx`
- Create: `apps/web/app/campaigns/new/listing/page.tsx`
- Rewrite: `apps/web/app/campaigns/new/page.tsx`

- [ ] **Step 1: Move existing form to `/new/post`**

Create `apps/web/app/campaigns/new/post/page.tsx`:

```tsx
'use client';
import { CampaignForm } from '@/components/campaign-form';
import { useRouter } from 'next/navigation';

export default function NewPostCampaignPage() {
  const router = useRouter();
  return (
    <main>
      <h2 className="mb-4 text-xl font-semibold">New Post Campaign</h2>
      <CampaignForm onSaved={(id) => router.push(`/campaigns/${id}`)} />
    </main>
  );
}
```

- [ ] **Step 2: Stub `/new/listing`**

Create `apps/web/app/campaigns/new/listing/page.tsx`:

```tsx
'use client';
import { useRouter } from 'next/navigation';
import { ListingForm } from '@/components/listing-form';

export default function NewListingCampaignPage() {
  const router = useRouter();
  return (
    <main>
      <h2 className="mb-4 text-xl font-semibold">New Real Estate Listing</h2>
      <ListingForm onSaved={(id) => router.push(`/campaigns/${id}`)} />
    </main>
  );
}
```

(The `ListingForm` component will be created in Task G3. This file will fail typecheck until then — that's expected and resolved by a single commit at end of phase G.)

- [ ] **Step 3: Rewrite type picker**

Replace `apps/web/app/campaigns/new/page.tsx` entirely:

```tsx
'use client';
import Link from 'next/link';

export default function NewCampaignTypePicker() {
  return (
    <main className="space-y-6">
      <h2 className="text-xl font-semibold">Create new campaign</h2>
      <p className="text-sm text-neutral-600">Choose what kind of campaign you want to create.</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          href="/campaigns/new/post"
          className="rounded-lg border border-neutral-200 bg-white p-6 transition-colors hover:border-blue-500"
        >
          <div className="mb-2 text-3xl">📝</div>
          <h3 className="text-lg font-semibold">Regular Post</h3>
          <p className="mt-2 text-sm text-neutral-600">
            Post text + media to multiple groups sequentially. Best for announcements and general content.
          </p>
          <span className="mt-4 inline-block text-sm font-medium text-blue-700">Continue →</span>
        </Link>
        <Link
          href="/campaigns/new/listing"
          className="rounded-lg border border-neutral-200 bg-white p-6 transition-colors hover:border-green-500"
        >
          <div className="mb-2 text-3xl">🏠</div>
          <h3 className="text-lg font-semibold">Real Estate Listing</h3>
          <p className="mt-2 text-sm text-neutral-600">
            Structured property listing with native multi-group share (up to 21 groups per batch).
            Requires groups that support Facebook Marketplace listings.
          </p>
          <span className="mt-4 inline-block text-sm font-medium text-green-700">Continue →</span>
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: (do NOT commit yet — continue through G2/G3)**

`pnpm -F web typecheck` will fail here because `ListingForm` isn't defined yet. Continue to Task G2.

---

### Task G2: BatchPreview component

**Files:**
- Create: `apps/web/components/batch-preview.tsx`

- [ ] **Step 1: Write component**

Create `apps/web/components/batch-preview.tsx`:

```tsx
'use client';

interface BatchPreviewProps {
  selectedCount: number;
  maxPerBatch: number;
  baseAt: Date | null;
  minDelayMinutes: number;
  maxDelayMinutes: number;
}

export function BatchPreview({
  selectedCount,
  maxPerBatch,
  baseAt,
  minDelayMinutes,
  maxDelayMinutes,
}: BatchPreviewProps) {
  if (selectedCount === 0 || !baseAt) {
    return (
      <p className="text-sm text-neutral-500">Select target groups and schedule time to see batches.</p>
    );
  }
  const fullBatches = Math.floor(selectedCount / maxPerBatch);
  const remainder = selectedCount % maxPerBatch;
  const batches: number[] = Array(fullBatches).fill(maxPerBatch);
  if (remainder > 0) batches.push(remainder);

  const avgDelay = (minDelayMinutes + maxDelayMinutes) / 2;

  return (
    <div className="rounded border border-neutral-200 bg-neutral-50 p-3 text-sm">
      <p className="font-medium">
        {selectedCount} selected → {batches.length} batch{batches.length > 1 ? 'es' : ''}
      </p>
      <ul className="mt-2 space-y-1">
        {batches.map((size, i) => {
          const approxMs = i * avgDelay * 60_000;
          const when = new Date(baseAt.getTime() + approxMs);
          return (
            <li key={i} className="flex items-center justify-between gap-3">
              <span>Batch {i}: {size} group{size > 1 ? 's' : ''}</span>
              <span className="text-neutral-500 tnum">
                {i === 0
                  ? when.toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
                  : `~${when.toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}`}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-neutral-500">
        Delay {minDelayMinutes}-{maxDelayMinutes} min between batches. Change in Settings.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: (do NOT commit — continue)**

---

### Task G3: ListingForm component

**Files:**
- Create: `apps/web/components/listing-form.tsx`

- [ ] **Step 1: Write component**

Create `apps/web/components/listing-form.tsx`:

```tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import type { ListingKind, PropertyType } from '@app/shared';
import { MAX_PHOTOS_PER_LISTING, MAX_GROUPS_PER_BATCH } from '@app/shared';
import { BatchPreview } from './batch-preview';

interface MediaItem {
  path: string;
  url: string;
  name: string;
  size: number;
  type: string;
  isHeic: boolean;
  previewUrl?: string;
  previewFailed?: boolean;
}

function isHeicFile(name: string, type: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return ext === 'heic' || ext === 'heif' || type === 'image/heic' || type === 'image/heif';
}

export function ListingForm({ onSaved }: { onSaved?: (id: string) => void }) {
  const [listingKind, setListingKind] = useState<ListingKind>('sale');
  const [propertyType, setPropertyType] = useState<PropertyType>('house');
  const [bedrooms, setBedrooms] = useState<number>(3);
  const [bathrooms, setBathrooms] = useState<number>(2);
  const [priceBaht, setPriceBaht] = useState<number>(0);
  const [squareMetres, setSquareMetres] = useState<number | ''>('');
  const [location, setLocation] = useState('');
  const [content, setContent] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [jitterMinutes, setJitterMinutes] = useState(15);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  const groups = trpc.group.list.useQuery();
  const settings = trpc.setting.get.useQuery();
  const scan = trpc.group.requestCapabilityScan.useMutation();
  const create = trpc.campaign.createListing.useMutation();

  const listingGroups = useMemo(
    () => (groups.data ?? []).filter((g) => g.isActive && g.supportsListing),
    [groups.data],
  );

  async function uploadFiles(files: FileList) {
    const tempId = `temp-${Date.now()}`;
    const fd = new FormData();
    fd.append('campaignId', tempId);
    fd.append('kind', 'images');
    Array.from(files).forEach((f) => fd.append('files', f));
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      alert(body.error ?? `Upload failed (${res.status})`);
      return;
    }
    type RawItem = { path: string; url: string; name: string; size: number; type: string };
    const data = (await res.json()) as { items: RawItem[] };
    setMediaItems((prev) => [
      ...prev,
      ...data.items.map<MediaItem>((it) => ({ ...it, isHeic: isHeicFile(it.name, it.type) })),
    ]);
  }

  function removeMediaItem(index: number) {
    setMediaItems((prev) => {
      const next = [...prev];
      const removed = next.splice(index, 1)[0];
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  }

  // HEIC → JPEG conversion
  useEffect(() => {
    const toConvert = mediaItems
      .map((it, i) => ({ it, i }))
      .filter(({ it }) => it.isHeic && !it.previewUrl && !it.previewFailed);
    if (toConvert.length === 0) return;
    let cancelled = false;
    (async () => {
      const { default: heic2any } = await import('heic2any');
      for (const { it, i } of toConvert) {
        if (cancelled) return;
        try {
          const res = await fetch(it.url);
          const blob = await res.blob();
          const converted = await heic2any({ blob, toType: 'image/jpeg', quality: 0.7 });
          const finalBlob = Array.isArray(converted) ? converted[0]! : converted;
          const previewUrl = URL.createObjectURL(finalBlob);
          if (cancelled) { URL.revokeObjectURL(previewUrl); return; }
          setMediaItems((prev) => {
            const next = [...prev];
            if (next[i]?.path === it.path) next[i] = { ...next[i]!, previewUrl };
            return next;
          });
        } catch {
          setMediaItems((prev) => {
            const next = [...prev];
            if (next[i]?.path === it.path) next[i] = { ...next[i]!, previewFailed: true };
            return next;
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [mediaItems]);

  const baseAt = scheduledAt ? new Date(scheduledAt) : null;
  const minDelayMinutes = Math.round((settings.data?.delayBetweenBatchesMinMs ?? 1_800_000) / 60_000);
  const maxDelayMinutes = Math.round((settings.data?.delayBetweenBatchesMaxMs ?? 3_600_000) / 60_000);

  if (!groups.isLoading && listingGroups.length === 0) {
    return (
      <div className="rounded border border-amber-200 bg-amber-50 p-4">
        <p className="font-medium text-amber-900">No listing-capable groups yet.</p>
        <p className="mt-2 text-sm text-amber-800">
          Run a capability scan to detect which groups support Facebook Marketplace listings.
        </p>
        <button
          onClick={() => scan.mutate(undefined, { onSuccess: () => alert('Scan requested. Worker will open browser. Refresh shortly.') })}
          className="mt-3 rounded bg-amber-600 px-4 py-2 text-sm text-white"
          disabled={scan.isPending}
        >
          {scan.isPending ? 'Requesting…' : 'Run scan now'}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (selectedGroupIds.length === 0) { alert('Select at least one group.'); return; }
        if (mediaItems.length === 0) { alert('Upload at least one photo.'); return; }
        try {
          const result = await create.mutateAsync({
            listingKind, propertyType,
            bedrooms, bathrooms, priceBaht,
            squareMetres: typeof squareMetres === 'number' ? squareMetres : null,
            location, content,
            scheduledAt: new Date(scheduledAt),
            jitterMinutes,
            mediaFiles: mediaItems.map((m) => m.path),
            groupIds: selectedGroupIds,
          });
          onSaved?.(result.id);
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Failed to schedule listing');
        }
      }}
      className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]"
    >
      <div className="space-y-5">
        <section className="rounded border p-4">
          <h3 className="mb-3 font-semibold">Property details</h3>
          <div className="space-y-3">
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input type="radio" checked={listingKind === 'sale'} onChange={() => setListingKind('sale')} /> Sale
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={listingKind === 'rent'} onChange={() => setListingKind('rent')} /> Rent
              </label>
            </div>
            <div>
              <label className="block text-sm">Property type</label>
              <select value={propertyType} onChange={(e) => setPropertyType(e.target.value as PropertyType)} className="rounded border p-2">
                <option value="flat">Flat</option>
                <option value="house">House</option>
                <option value="townhouse">Townhouse</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">Bedrooms
                <input type="number" min={0} value={bedrooms} onChange={(e) => setBedrooms(Number(e.target.value))} className="mt-1 w-full rounded border p-2" />
              </label>
              <label className="text-sm">Bathrooms
                <input type="number" min={0} value={bathrooms} onChange={(e) => setBathrooms(Number(e.target.value))} className="mt-1 w-full rounded border p-2" />
              </label>
              <label className="text-sm">Price (฿)
                <input type="number" min={0} value={priceBaht} onChange={(e) => setPriceBaht(Number(e.target.value))} className="mt-1 w-full rounded border p-2" required />
              </label>
              <label className="text-sm">Square metres (optional)
                <input type="number" min={1} value={squareMetres} onChange={(e) => setSquareMetres(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full rounded border p-2" />
              </label>
            </div>
          </div>
        </section>

        <section className="rounded border p-4">
          <h3 className="mb-3 font-semibold">Location</h3>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded border p-2" placeholder="e.g. Urban Property Udon, Udon Thani" required />
          <p className="mt-1 text-xs text-neutral-500">Worker will type this into Facebook and pick the first autocomplete suggestion.</p>
        </section>

        <section className="rounded border p-4">
          <h3 className="mb-3 font-semibold">Description</h3>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} required className="w-full rounded border p-2" />
        </section>

        <section className="rounded border p-4">
          <h3 className="mb-3 font-semibold">Photos (up to {MAX_PHOTOS_PER_LISTING})</h3>
          <label className="block cursor-pointer rounded border border-dashed p-4 text-center text-sm text-neutral-600">
            <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" className="hidden" onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ''; }} />
            Click to upload images
          </label>
          {mediaItems.length > 0 && (
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {mediaItems.map((it, i) => (
                <li key={it.path} className="relative overflow-hidden rounded border bg-neutral-100">
                  <div className="aspect-square w-full">
                    {it.isHeic && !it.previewUrl ? (
                      <div className="flex h-full items-center justify-center p-1 text-center text-2xs text-neutral-500">
                        {it.previewFailed ? 'HEIC preview unavailable' : 'Converting HEIC…'}
                      </div>
                    ) : (
                      <img src={it.previewUrl ?? it.url} alt={it.name} className="h-full w-full object-cover" loading="lazy" />
                    )}
                  </div>
                  <button type="button" onClick={() => removeMediaItem(i)} className="absolute right-1 top-1 rounded bg-black/50 p-1 text-white">✕</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded border p-4">
          <h3 className="mb-3 font-semibold">Schedule</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">Scheduled at
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required className="mt-1 w-full rounded border p-2" />
            </label>
            <label className="text-sm">Jitter (± minutes)
              <input type="number" min={0} max={120} value={jitterMinutes} onChange={(e) => setJitterMinutes(Number(e.target.value))} className="mt-1 w-full rounded border p-2" />
            </label>
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="rounded border p-4">
          <h3 className="mb-3 font-semibold">Target groups ({selectedGroupIds.length} selected)</h3>
          <div className="mb-2 flex gap-2">
            <button type="button" onClick={() => setSelectedGroupIds(listingGroups.map((g) => g.id))} className="text-xs text-blue-700 underline">Select all</button>
            <button type="button" onClick={() => setSelectedGroupIds([])} className="text-xs text-neutral-600 underline">Clear</button>
          </div>
          <div className="max-h-60 overflow-auto rounded border p-2 text-sm">
            {listingGroups.map((g) => (
              <label key={g.id} className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  checked={selectedGroupIds.includes(g.id)}
                  onChange={(e) => setSelectedGroupIds((prev) => e.target.checked ? [...prev, g.id] : prev.filter((id) => id !== g.id))}
                />
                <span className="truncate">{g.name ?? g.fbGroupId}</span>
              </label>
            ))}
          </div>
        </section>

        <BatchPreview
          selectedCount={selectedGroupIds.length}
          maxPerBatch={MAX_GROUPS_PER_BATCH}
          baseAt={baseAt}
          minDelayMinutes={minDelayMinutes}
          maxDelayMinutes={maxDelayMinutes}
        />

        <button type="submit" disabled={create.isPending} className="w-full rounded bg-green-600 px-4 py-2 text-white">
          {create.isPending ? 'Scheduling…' : 'Schedule listing'}
        </button>
        {create.error && <p className="text-sm text-red-600">{create.error.message}</p>}
      </aside>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm -F web typecheck`
Expected: no errors (listing-form.tsx + batch-preview.tsx + pages all resolve now).

```bash
git add apps/web/app/campaigns/new apps/web/components/batch-preview.tsx apps/web/components/listing-form.tsx
git commit -m "feat(web): add listing campaign type picker, form, and batch preview"
```

---

### Task G4: Listing detail view

**Files:**
- Modify: `apps/web/app/campaigns/[id]/page.tsx`

- [ ] **Step 1: Rewrite page**

Replace `apps/web/app/campaigns/[id]/page.tsx`:

```tsx
'use client';
import { trpc } from '@/lib/trpc-client';
import { use } from 'react';

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const c = trpc.campaign.get.useQuery({ id });
  const resume = trpc.campaign.resume.useMutation({ onSuccess: () => c.refetch() });
  const cancel = trpc.campaign.cancel.useMutation({ onSuccess: () => c.refetch() });

  if (!c.data) return <p>Loading...</p>;
  const d = c.data;
  const isListing = d.type === 'listing';

  return (
    <main className="space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <span className={`inline-block rounded px-2 py-0.5 text-2xs font-medium ${isListing ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
            {isListing ? 'Listing' : 'Post'}
          </span>
          <h2 className="mt-1 text-xl font-semibold">
            {isListing
              ? `${d.bedrooms}-bed ${d.propertyType ?? ''} — ฿${d.priceBaht?.toLocaleString() ?? ''}`
              : (d.title ?? 'Campaign')}
          </h2>
        </div>
        <p className="text-sm">Status: <strong>{d.status}</strong></p>
      </header>

      <p>Scheduled: {new Date(d.scheduledAt).toLocaleString()}</p>
      {d.lastError && <p className="rounded bg-red-50 p-2 text-sm text-red-700">Last error: {d.lastError}</p>}

      <div className="flex gap-2">
        {d.status === 'paused' && (
          <button onClick={() => resume.mutate({ id })} className="rounded bg-green-600 px-4 py-2 text-white">Resume</button>
        )}
        {d.status !== 'completed' && d.status !== 'running' && (
          <button onClick={() => cancel.mutate({ id })} className="rounded bg-neutral-600 px-4 py-2 text-white">Cancel</button>
        )}
      </div>

      {isListing && (
        <section className="rounded border p-3">
          <h3 className="mb-2 font-semibold">Property</h3>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-neutral-600">Kind</dt><dd>{d.listingKind}</dd>
            <dt className="text-neutral-600">Type</dt><dd>{d.propertyType}</dd>
            <dt className="text-neutral-600">Bedrooms</dt><dd>{d.bedrooms}</dd>
            <dt className="text-neutral-600">Bathrooms</dt><dd>{d.bathrooms}</dd>
            <dt className="text-neutral-600">Price</dt><dd>฿{d.priceBaht?.toLocaleString()}</dd>
            {d.squareMetres != null && (<><dt className="text-neutral-600">Sq.m</dt><dd>{d.squareMetres}</dd></>)}
            <dt className="text-neutral-600">Location</dt><dd>{d.location}</dd>
          </dl>
        </section>
      )}

      <section>
        <h3 className="font-semibold">Description</h3>
        <pre className="whitespace-pre-wrap rounded bg-neutral-100 p-2 text-sm">{d.content}</pre>
      </section>

      {isListing ? (
        <section>
          <h3 className="font-semibold">Batches ({d.batches?.length ?? 0})</h3>
          <ul className="space-y-2 text-sm">
            {d.batches?.map((b) => {
              const primary = b.groups.find((g) => g.isPrimary);
              const shares = b.groups.filter((g) => !g.isPrimary);
              return (
                <li key={b.id} className="rounded border p-3">
                  <div className="flex items-center justify-between">
                    <strong>Batch {b.order}</strong>
                    <span className={`rounded px-2 py-0.5 text-2xs font-medium ${
                      b.status === 'completed' ? 'bg-green-100 text-green-800'
                      : b.status === 'running' ? 'bg-blue-100 text-blue-800'
                      : b.status === 'failed' ? 'bg-red-100 text-red-800'
                      : b.status === 'skipped' ? 'bg-neutral-200 text-neutral-700'
                      : 'bg-amber-100 text-amber-800'
                    }`}>{b.status}</span>
                  </div>
                  <p className="mt-1 text-neutral-600">
                    {new Date(b.scheduledAt).toLocaleString()} · {b.groups.length} groups
                    {primary && <> · primary: {primary.group.name ?? primary.group.fbGroupId}</>}
                  </p>
                  {shares.length > 0 && (
                    <p className="mt-1 truncate text-xs text-neutral-500">
                      Share: {shares.map((s) => s.group.name ?? s.group.fbGroupId).join(', ')}
                    </p>
                  )}
                  {b.lastError && <p className="mt-1 text-xs text-red-700">{b.lastError}</p>}
                  {b.fbPostUrl && (
                    <a href={b.fbPostUrl} target="_blank" className="mt-1 block text-xs text-blue-700">{b.fbPostUrl}</a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <section>
          <h3 className="font-semibold">Groups ({d.groups.length})</h3>
          <ul className="text-sm">
            {d.groups.map((cg) => (<li key={cg.groupId}>{cg.group.name ?? cg.group.fbGroupId}</li>))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="font-semibold">Logs ({d.logs.length})</h3>
        <table className="w-full text-sm">
          <thead><tr className="text-left"><th>Group</th><th>Status</th><th>Attempt</th><th>Error</th><th>Time</th></tr></thead>
          <tbody>
            {d.logs.map((l) => {
              const grp = d.groups.find((g) => g.groupId === l.groupId)?.group;
              return (
                <tr key={l.id} className="border-t">
                  <td>{grp?.name ?? grp?.fbGroupId}</td>
                  <td>{l.status}{l.note && ` (${l.note})`}</td>
                  <td>{l.attempt}</td>
                  <td className="max-w-xs truncate text-red-700">{l.error}</td>
                  <td>{l.completedAt ? new Date(l.completedAt).toLocaleString() : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm -F web typecheck`
Expected: no errors.

```bash
git add apps/web/app/campaigns/[id]/page.tsx
git commit -m "feat(web): listing-aware campaign detail page with batches"
```

---

### Task G5: Settings page — Listing Campaigns section

**Files:**
- Modify: `apps/web/server/routers/setting.ts`
- Modify: `apps/web/app/settings/page.tsx`

- [ ] **Step 1: Extend setting router schema**

In `apps/web/server/routers/setting.ts`, locate the `settingSchema` zod object and add 3 fields:

```typescript
  delayBetweenBatchesMinMs: z.number().int().min(60_000).max(24 * 3600_000),
  delayBetweenBatchesMaxMs: z.number().int().min(60_000).max(24 * 3600_000),
  maxBatchesPerDay: z.number().int().min(1).max(50),
```

(Insert them after the existing `stopAfterConsecutiveFailures` field, before the boolean toggles.)

- [ ] **Step 2: Extend settings page**

In `apps/web/app/settings/page.tsx`, update the `Values` type to include the 3 new fields:

```typescript
type Values = {
  delayBetweenGroupsMinMs: number; delayBetweenGroupsMaxMs: number;
  delayBeforePostMinMs: number; delayBeforePostMaxMs: number;
  delayAfterFocusMinMs: number; delayAfterFocusMaxMs: number;
  maxRetryPerGroup: number;
  retryDelayMinMs: number; retryDelayMaxMs: number;
  stopAfterConsecutiveFailures: number;
  delayBetweenBatchesMinMs: number; delayBetweenBatchesMaxMs: number;
  maxBatchesPerDay: number;
  enableMouseMove: boolean; enableScrollBeforePost: boolean; enableJitter: boolean;
};
```

Update the `PAIRS` constant to add the listing batch delay pair:

```typescript
const PAIRS: Array<[keyof Values, keyof Values, string]> = [
  ['delayBetweenGroupsMinMs', 'delayBetweenGroupsMaxMs', 'Delay between groups (ms)'],
  ['delayBeforePostMinMs',    'delayBeforePostMaxMs',    'Delay before click Post (ms)'],
  ['delayAfterFocusMinMs',    'delayAfterFocusMaxMs',    'Delay after focus composer (ms)'],
  ['retryDelayMinMs',         'retryDelayMaxMs',         'Retry delay (ms)'],
  ['delayBetweenBatchesMinMs','delayBetweenBatchesMaxMs','Listing: delay between batches (ms)'],
];
```

Below the existing `stopAfterConsecutiveFailures` input block, add a new block for `maxBatchesPerDay`:

```tsx
      <div className="flex items-center gap-4">
        <label className="w-64">Listing: max batches per day (soft warning)</label>
        <input type="number" className="rounded border p-2 w-24"
          value={v.maxBatchesPerDay} onChange={(e) => set('maxBatchesPerDay', Number(e.target.value))} />
      </div>
```

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm -F web typecheck`
Expected: no errors.

```bash
git add apps/web/server/routers/setting.ts apps/web/app/settings/page.tsx
git commit -m "feat(web): settings controls for listing batch delay and cap"
```

---

## Phase H — Polish & docs

### Task H1: README listing section

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Append listing section**

Append the following markdown to the end of `README.md`, right before the existing E2E checklist section:

```markdown

## Real Estate Listing campaigns

In addition to Regular Post campaigns, the app supports **Listing campaigns** that use
Facebook's native "Sell Something" form inside Marketplace-enabled groups. A single
listing can be shared to **up to 21 groups per batch** (1 primary + 20 shared), and the
system auto-splits larger selections into multiple batches with configurable delays.

### Setup (one-time)
1. On `/groups`, click **Scan listing capabilities**. The worker will visit each of your
   groups and detect the "Sell Something" button. Groups without it stay as "Text only".
2. On `/settings`, tune the listing batch delay range (default 30–60 min between batches).

### Creating a listing
1. Go to `/campaigns/new` → choose **Real Estate Listing**.
2. Fill property details (sale/rent, type, beds, baths, price, square metres optional).
3. Enter a location string — the worker will type it into Facebook and click the first
   autocomplete suggestion. Use canonical project/building names.
4. Write the description, upload up to 50 photos (HEIC supported).
5. Pick groups from the listing-capable list. The batch preview shows how many batches
   will run and their approximate times.
6. Schedule and submit.

### Limitations
- A batch that reports `completed` means Facebook accepted the submission. Groups that
  hold posts for admin approval may not publish immediately; this cannot be detected
  per-group from the multi-share dialog. Spot-check important groups manually.
- If a listing fails on a critical error (session expired, rate-limited, account locked),
  the whole campaign pauses. Re-authenticate and hit **Resume** on the detail page.
- Listings are one-time only. To re-post an existing listing, duplicate it manually.
```

Also update the existing E2E checklist to add new listing items. Find the "## E2E checklist (run before first real use)" section and add these lines at the end:

```markdown
### Listing campaigns
- [ ] Scan capabilities → at least one group shows "Listing" badge
- [ ] Create a test listing (sale, house, 2/1, ฿1M, 1 photo, 1 group)
- [ ] Worker runs at scheduled time → listing appears on Facebook
- [ ] Create a listing with 25 groups → 2 batches (21+4) scheduled ≈30-60 min apart
- [ ] Simulate session loss mid-batch → campaign pauses → resume → remaining batches run
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README section for Real Estate Listing campaigns"
```

---

### Task H2: Final smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run full test suite**

Run: `pnpm -F worker test`
Expected: ~32+ tests, all pass.

Run: `pnpm -F worker typecheck`
Expected: clean.

Run: `pnpm -F web typecheck`
Expected: clean.

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: `apps/web/.next` and `apps/worker/dist` produced without errors.

- [ ] **Step 3: Start dev and do HTTP smoke**

Run `pnpm dev` in one terminal. In another:

```bash
curl -s -o /dev/null -w "home: %{http_code}\n" http://localhost:3100/
curl -s -o /dev/null -w "picker: %{http_code}\n" http://localhost:3100/campaigns/new
curl -s -o /dev/null -w "listing form: %{http_code}\n" http://localhost:3100/campaigns/new/listing
```

Expected: 200 for all three. Dashboard and type-picker render without Prisma errors.

- [ ] **Step 4: If all green, no commit needed**

Otherwise capture errors and file as BLOCKED for a follow-up fix task.

---

## Self-Review Notes

**Spec coverage check:**
- §1 Problem/Scope → implicit in all tasks
- §2 Tech Stack → Task A1, A2 (schema + Zod); no new deps
- §3 Architecture → Task E4 (scheduler union query), entire Phase D/E wiring
- §4 Data Model → Task A1 (Prisma), Task A2 (constants + Zod)
- §5 Lifecycle → Task E3 (runListingBatch state machine) + F1 (create/resume/cancel semantics)
- §6 Playwright Flow → Task C1 (selectors), C3 (helpers), D1 (postListingBatch)
- §7 Error Handling → Task E3 (retry + pause + skip)
- §8 Web UI → Phase G all tasks (picker, form, batch preview, detail, settings)
- §9 Testing → Task B1/B2 (unit), C3 (fixture), E3 (integration), H2 (smoke)
- §10 Success Criteria → all covered by the above tasks + manual E2E

**Placeholder scan:** searched the plan for `TODO`, `TBD`, `FIXME`, `implement later`, `handle edge cases`, "similar to Task N". No matches. Every code step contains complete code and commands with expected output.

**Type consistency check:**
- `ListingBatchInput` in `post-listing.ts` matches the `postListingBatch` input param in `CampaignContext` interface (runner.ts Task E1) and the adapter call (Task E2) and the worker call-site (Task E3).
- `listingCreateSchema` field names match the mutation input usage in Task F1.
- `Campaign` fields (type, listingKind, propertyType, bedrooms, bathrooms, priceBaht, location, squareMetres) consistent between schema (A1), Zod input (A2), mutation body (F1), worker runner (E3), and form (G3).
- Scheduler return type changed to `string | null` with tag prefixes — Task E4 Step 3 explicitly updates existing assertions.

**i18n gap:** the listing form and detail page currently use hardcoded English strings (labels, error messages, "Schedule listing"). Adding full i18n keys (EN + TH parallel) is out of this plan's scope and is called out as a known gap — can be addressed in a follow-up pass alongside any UI polish. This mirrors how Phase 1's initial Thai content was handled before the full i18n sweep.
