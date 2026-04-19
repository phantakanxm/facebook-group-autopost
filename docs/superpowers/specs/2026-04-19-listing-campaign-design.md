# Listing Campaign — Design Spec

**Date:** 2026-04-19
**Status:** Draft (awaiting user review)
**Owner:** phantakan.mongkol@gmail.com
**Depends on:** `2026-04-17-facebook-group-autopost-design.md` (Phase 1 base system), Phase 1 listing capability scanner (commit `93b6546`)

## 1. Problem & Scope

The user is a real estate agent posting property listings to many Facebook groups. The existing Regular Post flow (text + media, loop per group) is suboptimal for this use case: slow, high ban risk (bot-like pattern), no structured property fields, no use of Facebook's native "Post to more groups" multi-share feature.

This spec adds a second campaign type — **Listing** — that uses Facebook's Marketplace-style "Sell Something" form inside groups, with native "Post to more groups" (up to 21 groups per post). The existing Regular Post flow stays for text-only groups without Marketplace enabled.

### In scope
- New `Campaign.type = 'listing'` discriminator on the existing Campaign table
- Property fields: `listingKind (sale|rent)`, `propertyType (flat|house|townhouse)`, `bedrooms`, `bathrooms`, `priceBaht`, `location`, `squareMetres` (optional), `description` (reuses `content`)
- Photos: up to **50** per listing (FB max), reuses existing media upload + HEIC pipeline
- `ListingBatch` model: splits selected groups into batches of ≤21; each batch has 1 primary + up to 20 share groups
- Auto-batching: user selects N groups → system creates `⌈N / 21⌉` batches with staggered schedules
- Playwright flow to fill the "Property for sale or rent" form + select share groups + click Publish
- Error handling with smart per-batch retry (transient → retry 2× → skip; critical → pause campaign)
- UI: `/campaigns/new` type picker; new ListingForm; Listing detail page with batches
- Shows only `supportsListing=true` groups in Listing creation

### Out of scope (explicitly)
- Rent mode polish (spec models it; user will primarily use sale)
- "Boost/re-post" recurring listings (listings are one-time per design decision)
- Per-group posting verification after multi-share publish (can't reliably inspect each target group)
- Dynamic form-field detection (hardcoded for the 8 FB fields in the screenshots)
- Google/Nominatim location picker (user types, worker clicks first FB suggestion)
- Selector health auto-repair (drift alerts only; manual selector updates on FB UI changes)
- Rich text / Lexical-aware description formatting (plain text only)

### Known risks
- Facebook may change the listing form layout → selector drift → manual fix in `selectors.ts`
- Facebook's "Post to more groups" limit (21) may change; constant centralized in `@app/shared`
- Primary-group posting succeeds but share groups held for admin approval won't show as published — cannot be detected reliably. Documented as known limitation in README.
- Location autocomplete first-suggestion may be wrong for ambiguous addresses; user should paste canonical project/building names.

## 2. Tech Stack

Reuses all existing stack from Phase 1. No new runtime dependencies are required for MVP:

- TypeScript, Node.js ≥ 20, pnpm workspaces
- Next.js 15, tRPC v11, Prisma + SQLite, Playwright + stealth, Vitest

The one additional client-side library already installed for photo preview (`heic2any`) continues to serve the 50-photo listing form.

## 3. Architecture

### 3.1 Data-flow overview

```
User → Web UI → tRPC campaign.createListing
                 │
                 ▼
            Campaign (type='listing')
            + ListingBatch × ⌈N/21⌉
            + ListingBatchGroup (M2M, with isPrimary flag)
                 │
                 ▼
            Scheduler (every 30 s)
              picks earliest due batch
                 │
                 ▼
            Worker runs postListingBatch(ctx, batch)
                 ├─ navigate to primary group
                 ├─ click "Sell Something"
                 ├─ pick "Property for sale or rent"
                 ├─ upload photos
                 ├─ fill dropdowns, numbers, location, description
                 ├─ click Next → select share groups (up to 20)
                 └─ click Publish
                 │
                 ▼
            Update Batch status + PostLog
                 │
                 ▼
            If last batch → Campaign.status='completed'
            Else scheduler picks next batch at its scheduledAt
```

### 3.2 Scheduler picking logic

Extended to handle both campaign types:

- Regular post campaigns: existing — `campaign.findFirst({ type: 'post', status: 'scheduled', scheduledAt <= now })`
- Listing campaigns: NEW — `listingBatch.findFirst({ status: 'scheduled', scheduledAt <= now, campaign: { type: 'listing', status: { not: 'paused' } } })`
- The scheduler runs whichever is earliest among both queries.

### 3.3 File organisation (additions)

```
packages/shared/src/
├── constants.ts             # + CAMPAIGN_TYPES, LISTING_KINDS, PROPERTY_TYPES, MAX_PHOTOS_PER_LISTING, MAX_GROUPS_PER_BATCH
├── schemas/
│   └── listing.ts           # NEW — listingCreateSchema (Zod)

apps/worker/src/
├── campaigns/
│   ├── batching.ts          # NEW — batchSplit + scheduleForBatches
│   ├── batching.test.ts     # NEW
│   ├── listing-runner.ts    # NEW — runListingCampaign (branches from runCampaign)
│   └── listing-runner.test.ts
├── playwright/
│   ├── selectors.ts         # EXTEND — listing* + shareGroup* selectors
│   ├── post-listing.ts      # NEW — postListingBatch(ctx, batch)
│   └── human-listing.ts     # NEW — helpers for combobox selection, autocomplete handling

apps/web/
├── app/campaigns/
│   ├── new/page.tsx         # REWRITE — type picker (Post vs Listing)
│   ├── new/post/page.tsx    # MOVE existing form here
│   └── new/listing/page.tsx # NEW — ListingForm
├── components/
│   ├── listing-form.tsx     # NEW
│   └── batch-preview.tsx    # NEW — live batch split preview component
└── server/routers/
    └── campaign.ts          # EXTEND — createListing mutation, branch on type in get/list

apps/worker/test/fixtures/
└── fb-listing-form.html     # NEW — offline fixture mirroring FB's form
```

## 4. Data Model

### 4.1 Campaign (extended)

```prisma
model Campaign {
  id            String    @id @default(cuid())
  userId        String
  title         String?
  content       String
  mediaFiles    String    @default("[]")
  mediaType     String    @default("none")

  // Discriminator
  type          String    @default("post")   // "post" | "listing"

  // Listing-only (nullable when type='post')
  listingKind   String?   // "sale" | "rent"
  propertyType  String?   // "flat" | "house" | "townhouse"
  bedrooms      Int?
  bathrooms     Int?
  priceBaht     Int?
  location      String?
  squareMetres  Int?

  // Listing batch delay override (nullable = use Settings defaults)
  batchDelayMinMs Int?
  batchDelayMaxMs Int?

  scheduledAt   DateTime
  recurrence    String?   // null for listing
  jitterMinutes Int       @default(15)

  status        String    @default("draft")
  startedAt     DateTime?
  completedAt   DateTime?
  lastError     String?

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  user    User             @relation(fields: [userId], references: [id])
  groups  CampaignGroup[]
  logs    PostLog[]
  batches ListingBatch[]
}
```

### 4.2 ListingBatch (new)

```prisma
model ListingBatch {
  id           String    @id @default(cuid())
  campaignId   String
  order        Int
  scheduledAt  DateTime

  status       String    @default("scheduled")  // scheduled|running|completed|failed|skipped
  startedAt    DateTime?
  completedAt  DateTime?
  attempt      Int       @default(0)
  lastError    String?
  fbPostUrl    String?
  note         String?   // e.g. "partial_share:g1,g4"

  createdAt    DateTime  @default(now())

  campaign     Campaign             @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  groups       ListingBatchGroup[]

  @@index([status, scheduledAt])
}
```

### 4.3 ListingBatchGroup (new, M2M)

```prisma
model ListingBatchGroup {
  batchId     String
  groupId     String
  isPrimary   Boolean  @default(false)   // exactly 1 per batch = true
  order       Int                          // ordering within batch

  batch       ListingBatch  @relation(fields: [batchId], references: [id], onDelete: Cascade)
  group       Group         @relation(fields: [groupId], references: [id])

  @@id([batchId, groupId])
}
```

### 4.4 Group (extended relation)

```prisma
model Group {
  // existing fields including supportsListing + listingScannedAt (Phase 1)
  batches     ListingBatchGroup[]   // NEW reverse relation
}
```

### 4.5 Setting (extended)

```prisma
model Setting {
  // existing delay fields …

  delayBetweenBatchesMinMs Int @default(1_800_000)  // 30 min
  delayBetweenBatchesMaxMs Int @default(3_600_000)  // 60 min
  maxBatchesPerDay         Int @default(5)          // soft warning
}
```

### 4.6 Shared constants

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

## 5. Campaign Lifecycle

### 5.1 Campaign-level state machine (unchanged)

```
[draft] → [scheduled] → [running] → [completed]
                            │
                            └→ [paused] → (resume) → [scheduled]
```

For listing campaigns, `[running]` means "at least one batch has started". The campaign returns to `completed` only after the LAST batch finishes (success or skipped). A `paused` campaign holds all remaining batches until the user resumes.

### 5.2 Batch-level state machine (new)

```
[scheduled] → [running] ─── success ───→ [completed]
                   │
                   ├── transient fail, attempt ≤ 2 → [scheduled] (retry with delay)
                   │
                   ├── transient fail, attempt > 2 → [skipped] (continue campaign)
                   │
                   └── critical fail (session/rate/lock) → [failed]
                                                            + pause parent campaign
                                                            + halt remaining batches
```

### 5.3 Creation (splitting groups into batches)

On `campaign.createListing` mutation:

1. Validate input with `listingCreateSchema`.
2. Fetch user's Setting row for batch delays.
3. Call `batchSplit(selectedGroups, MAX_GROUPS_PER_BATCH = 21)` → ordered `Batch[]`, each with `[primary, ...share]` of length 1..21.
4. Call `scheduleForBatches(campaign.scheduledAt, { count: batches.length, minDelayMs, maxDelayMs })` → `Date[]` with staggered start times and jitter applied.
5. Create one Prisma transaction:
   - `Campaign` row with type='listing' and all listing fields
   - `ListingBatch` × N with the computed `scheduledAt` values
   - `ListingBatchGroup` entries with `isPrimary = (index === 0)` and `order = index`
6. Return created campaign id.

### 5.4 Scheduler pickup (listing path)

The existing scheduler `pollAndRunOnce` is extended to:

1. Query `listingBatch.findFirst({ status: 'scheduled', scheduledAt <= now, campaign: { type: 'listing', status: { notIn: ['paused','completed','failed'] } } })` ordered by `scheduledAt asc`.
2. Query regular campaigns (existing).
3. Run whichever is earliest.
4. For a batch pickup:
   - Atomic lock: `batch.updateMany({ where: { id, status: 'scheduled' }, data: { status: 'running', startedAt: now } })`
   - If `lock.count === 0` (another tick won), skip.
   - Ensure parent campaign is in `running` status (set if not).
   - Call `runListingBatch(batch.id)` which opens a browser context from the adapter and delegates to `postListingBatch`.
   - On return, update batch status, aggregate campaign completion check.

### 5.5 Resume

On `campaign.resume`:

- Only allowed if `campaign.status === 'paused'`.
- Find all batches with `status IN ('failed', 'scheduled')` and `order >= firstPendingBatchOrder`.
- Reschedule them starting at `now + 5 min`, staggered by `delayBetweenBatches`.
- Reset their `attempt` counter to 0 and clear `lastError`.
- Set `campaign.status = 'scheduled'` with `scheduledAt` of the first pending batch.
- Scheduler picks them up on next tick.

### 5.6 Cancel

`campaign.cancel`:

- Only allowed if `campaign.status !== 'running'` (a currently-posting batch is allowed to complete its attempt; user can retry cancel after).
- Mark `campaign.status = 'completed'`, `completedAt = now()`.
- All batches with `status === 'scheduled'` → `status = 'skipped'`.

## 6. Playwright Flow

Each batch runs through `postListingBatch(ctx, batch)`. The function shares the same `ctx` across all batches for the campaign (opened by the adapter once, closed at the end).

### 6.1 Step sequence

1. **Navigate** to primary group URL. `waitUntil: 'domcontentloaded'`, timeout 45 s. `humanDelay(2000, 5000)`. `detectFBState` (abort if not ok).
2. **Click "Sell Something"** via `SELECTORS.listingButton`. `humanClick`. Wait for category modal. `humanDelay(1000, 2000)`.
3. **Pick category** "Property for sale or rent" via `SELECTORS.listingCategoryPropertyForSaleOrRent`. `humanClick`. `humanDelay(1500, 2500)` for main form to render.
4. **Upload photos first** — FB shows the upload area at the top of the form. Locate the scoped file input `[role="dialog"] input[type="file"][accept*="image"]`. `setInputFiles(paths)`. Sleep `3000 + N × 800` ms for thumbnails.
5. **Dropdowns** (sale/rent, property type): `humanClick` combobox → wait for role=listbox → `humanClick` option by name. Two combined with `humanDelay(300, 800)` between.
6. **Numeric fields** (bedrooms, bathrooms, price, sqm if present): click → `humanDelay` → `page.keyboard.type(String(value), { delay: 50-150ms })` → Tab out.
7. **Location (autocomplete)**: `humanClick` on location textbox → `keyboard.insertText(location)` → sleep 1800 ms → look for `role=listbox` → `humanClick` first option. Fallback: if no suggestions after 3 s, retype shortened query once before giving up (see Section 7).
8. **Description**: `humanClick` textbox → `keyboard.insertText(content)` → `humanDelay(500, 1500)`.
9. **Click Next** → wait for share-groups panel. `humanDelay(2000, 4000)`.
10. **Select share groups** (up to 20). For each group:
    - Click search box → type group name (or fragment).
    - Wait for filtered list.
    - `humanClick` on the checkbox row.
    - `humanDelay(400, 800)`.
    - If group not found after type + short wait → log warning, continue.
11. **Click Publish**. Sleep 6 s for FB to replicate to up to 21 groups.
12. **Verify** success banner via `detectFBState` + explicit success text probe `text=/โพสต์แล้ว|Listing published|Posted/i`. Capture `fbPostUrl` from browser URL if FB redirects.
13. **Update DB**: `ListingBatch` → `completed`, `fbPostUrl`, `note` (if partial share). For each group in batch → `Group.lastPosted = now()`.

### 6.2 Selectors (new, in `selectors.ts`)

All bilingual (Thai + English) where applicable. A fallback chain (`firstMatch` against array) for each:

- `listingCategoryPropertyForSaleOrRent[]`
- `listingKindCombobox[]`, option by `name=/^Sale$|^ขาย$/i` and `name=/^Rent$|^ให้เช่า$/i`
- `propertyTypeCombobox[]`, option by type name
- `listingBedroomsInput[]`, `listingBathroomsInput[]`, `listingPriceInput[]`, `listingSqmInput[]`
- `listingLocationCombobox[]`, `listingLocationListbox`, `listingLocationFirstOption`
- `listingDescriptionTextbox[]`
- `listingNextButton[]`, `listingPublishButton[]`
- `shareGroupSearch[]`, `shareGroupRowByName(name)` (builder fn)
- `listingPublishedBanner[]`

### 6.3 Human-like touches

- Scroll within the modal before clicking Next.
- Mouse jiggle near Publish button before clicking (listings are higher-commitment actions).
- Randomise field fill order 10 % of the time (bedrooms → price → bathrooms vs strict top-to-bottom).

## 7. Error Handling

### 7.1 Error category matrix

| Category | Trigger | Response |
|---|---|---|
| session_invalid | redirect to /login | pause campaign, mark sessionValid=false, banner |
| account_locked | checkpoint/captcha | pause **all** campaigns, critical alert |
| rate_limited | "Going Too Fast" banner | pause campaign + cooldown 1 h |
| category_not_found | "Property for sale or rent" menu absent | selector_not_found, screenshot, fail batch, alert |
| location_not_resolved | autocomplete returns 0 options after retry | transient → retry up to 2 × → skip batch |
| share_group_not_found | ≥ 1 share group missing from FB list | log warning per group, continue batch, note = partial_share |
| publish_button_disabled | required field empty (our bug) | selector_not_found, fail, alert |
| photo_upload_stalled | thumbnails never render | transient → retry batch |
| selector_drift | any step selector missing | selector_not_found, fail, alert |
| listing_not_available | "Sell Something" absent despite supportsListing=true | auto-mark supportsListing=false + fail batch + alert |

### 7.2 Retry logic (per batch)

- attempt 1 fails (transient) → wait `random(3, 5)` min → attempt 2
- attempt 2 fails (transient) → wait `random(5, 10)` min → attempt 3
- attempt 3 fails → `batch.status = 'skipped'`, continue campaign
- any critical error → `batch.status = 'failed'`, pause parent campaign, no more retries

### 7.3 Screenshot + HTML dump

- On any failure: full-page screenshot → `logs/screenshots/listing-{campaignId}-{batchId}-{ts}.png`.
- On `selector_not_found`: first 50 KB of HTML → `logs/html/listing-{…}.html`.
- Retention 14 days (matches existing policy).

### 7.4 Selector drift alert

If `selector_not_found` occurs ≥ 2 times within a single UTC day: surface a red banner on Dashboard ("Facebook listing UI may have changed — selectors need attention").

### 7.5 Partial-share documentation

README gains a "Listing limitations" section:

> A listing batch that reports `completed` means FB accepted the submission. Some share groups may hold the post for admin approval (or silently drop it) without our client being able to detect it. Spot-check critical groups manually. When the gap matters, create a Regular Post campaign for that specific group as a fallback.

## 8. Web UI

### 8.1 Routing

```
/campaigns                      list (type-badged)
/campaigns/new                  type picker (NEW)
/campaigns/new/post             existing form (moved)
/campaigns/new/listing          new form (NEW)
/campaigns/[id]                 detail — branches on type
```

### 8.2 Type picker

Two equal cards on `/campaigns/new`:

- **Regular Post**: text + media, loops groups. Best for general announcements.
- **Real Estate Listing**: structured property listing, native multi-group share (up to 21 per batch). Best for property sales/rentals.

Each card links to the respective creation route.

### 8.3 ListingForm (`/campaigns/new/listing`)

Layout mirrors existing CampaignForm (2-column: form left, group picker right). Sections:

- **Property details**: sale/rent radio; property type dropdown; bedrooms + bathrooms number inputs; price input (THB, thousand-separated display); sqm (optional).
- **Location**: single text field with helper copy "Type address/project name — worker picks first suggestion on Facebook."
- **Description**: textarea (reuses `content`).
- **Photos**: dropzone + preview grid, cap 50. Reuses existing HEIC pipeline.
- **Scheduling**: datetime-local + jitter minutes. No recurrence (listings are one-time).

**Right column (group picker)**:

- Filtered to `supportsListing=true` only.
- If empty: banner "No listing-capable groups found" + button "Run scan now" (calls `group.requestCapabilityScan`).
- Live **batch preview** below the list: "45 selected → 3 batches (21, 21, 3)". When hovered, shows per-batch scheduled times (based on user settings).
- Soft warning if selected count > `maxBatchesPerDay × 21`.

### 8.4 Listing detail (`/campaigns/[id]` when type='listing')

- **Header**: auto-generated title (e.g. "3-bed Townhouse — ฿3,500,000"), sale/rent badge, status, created timestamp.
- **Property card**: type, beds, baths, price, sqm, location, all read-only.
- **Description**: full content.
- **Photos**: thumbnail grid.
- **Batches panel**: ordered cards per batch (status icon, scheduled at, group count, primary-group chip, fbPostUrl if success). Actions: Resume (if paused), Cancel remaining (if any scheduled).
- **Attempt logs**: timeline per batch with attempt, status, error message, screenshot link.

### 8.5 Groups page integration

No new UI on `/groups`. The Phase 1 badge ("Listing" / "Text only" / "Not scanned") is the only indicator. Listing creation gating happens in the ListingForm.

### 8.6 Dashboard integration

- "Running" and "Upcoming" cards show type badges.
- "Recent activity" splits stats per type (Posts vs Listings).
- New "Alerts" section: paused campaigns count, stale scans (>30 d), partial-share batches.

### 8.7 Settings page

New section "Listing Campaigns":

- Delay between batches (min / max, in ms, default 1 800 000 / 3 600 000).
- Max batches per day (default 5, soft warning only).

### 8.8 tRPC mutations added

```typescript
campaign.createListing(input: listingCreateInput) → { id: string }
```

Existing `campaign.get`, `campaign.list`, `campaign.resume`, `campaign.cancel` are polymorphic (work for both types). `campaign.list` includes enough data to render type badges. `campaign.get` returns `batches` when type='listing'.

## 9. Testing Strategy

### 9.1 Unit tests (Vitest)

- `batchSplit`: splitting, primary flagging, order preservation, edge cases (0, 1, 20, 21, 22, 42, 50 groups).
- `scheduleForBatches`: first batch = base; Nth batch = previous + random(min, max); independent of absolute time zone.
- `listingCreateSchema`: required fields, enum validation, photo count ≤ 50, sqm nullable.

### 9.2 Integration tests (in-memory SQLite + mocked adapter)

- Listing campaign happy path: 50 groups → 3 batches → all succeed → status completed.
- Critical error in batch 1 → campaign paused, batch 2 not run.
- Transient error retry then succeed.
- Transient error ≥ 3 times → batch skipped, campaign continues.
- Resume after pause → failed batch + later batches rescheduled.

### 9.3 Fixture tests (Playwright offline)

New `apps/worker/test/fixtures/fb-listing-form.html` with inputs mirroring FB screenshots. Tests for `fillListingForm` and `resolveLocationAutocomplete` run against file:// URL.

### 9.4 Manual E2E checklist

New section in README covering: scan → create → batch preview → worker run → verify on FB → simulate session loss → resume → failure paths (invalid location, non-existent share group, >50 photos rejected client-side).

### 9.5 Expected test count after implementation

```
Existing:  21
+ batchSplit:                  5
+ scheduleForBatches:           4
+ listingCreateSchema:          6
+ listing-runner integration:   5
+ fillListingForm fixture:      3
=========================
Total ≈ 44
```

## 10. Success Criteria

- User can scan groups, see capability badges, and create a Listing campaign from a form that only exposes listing-capable groups.
- A listing with 50 groups becomes 3 batches scheduled 30–60 minutes apart (configurable).
- Each batch posts via the native Sell Something form with all 8 required fields filled and up to 20 share groups selected.
- On critical errors the campaign pauses and a resume flow reschedules remaining batches without duplicating already-posted ones.
- HEIC photos upload and preview correctly (reused from existing work).
- Regular Post campaigns continue to work exactly as before — no behavior regression.
- Total test count reaches ~44 with all tests green.

## 11. Open Questions / Future Decisions

None blocking — user has approved the six design sections.

**Deferred to Phase 3+:**

- "Boost Now" button to re-post an existing listing (manual trigger).
- Rent-specific fields (available date, deposit amount) if user pivots to rental focus.
- Location picker with map preview (Nominatim/Google Places integration).
- Listing analytics (views per group, if FB Graph permits).
- Selector auto-repair / self-healing.
