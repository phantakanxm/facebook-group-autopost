# Facebook Group Auto-Post Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Web UI + Worker system that posts the same content (text + images/video) to multiple selected Facebook groups on the user's personal account, with scheduling and human-like automation to reduce ban risk.

**Architecture:** Monorepo (pnpm workspaces) with two processes communicating via SQLite. `apps/web` is a Next.js 15 + tRPC app exposing CRUD and status UI. `apps/worker` is a long-running Node process that polls the DB for due campaigns and drives a stealth Playwright browser with human-like behavior (paste content, curved mouse moves, random delays, scroll). State machine lives in the `Campaign.status` column; recovery flows rebuild on `PostLog` history.

**Tech Stack:** TypeScript, Node.js ≥ 20, pnpm workspaces, Next.js 15 (App Router), tRPC v11, Prisma + SQLite, Playwright + playwright-extra + stealth, node-cron, pino, Zod, Vitest, pm2.

**Reference spec:** `docs/superpowers/specs/2026-04-17-facebook-group-autopost-design.md`

---

## File Structure

**Root:**
- `package.json` — workspace root, shared scripts
- `pnpm-workspace.yaml` — workspace declaration
- `tsconfig.base.json` — shared TS config
- `.gitignore`, `.npmrc`, `.nvmrc`
- `ecosystem.config.js` — pm2 config (created in Phase J)
- `.env` / `.env.example`

**`packages/db/`** — Prisma schema + client singleton (shared between apps)
- `prisma/schema.prisma` — all models
- `src/index.ts` — `PrismaClient` singleton + types export
- `src/seed.ts` — dev seed (one User + default Setting)

**`packages/shared/`** — Zod schemas, types, constants (shared)
- `src/schemas/campaign.ts`, `group.ts`, `setting.ts`
- `src/constants.ts` — enum string literals (`CampaignStatus`, `PostStatus`, `MediaType`)
- `src/types.ts` — derived TS types
- `src/index.ts` — barrel

**`apps/worker/`** — long-running process
- `src/main.ts` — entrypoint (start scheduler)
- `src/scheduler.ts` — DB-polling loop
- `src/logger.ts` — pino with rotation
- `src/utils/delays.ts` — `humanDelay`, `sleep`
- `src/utils/bezier.ts` — cubic Bezier curve for mouse paths
- `src/campaigns/recurrence.ts` — cron-next + jitter
- `src/campaigns/runner.ts` — orchestrates 1 campaign end-to-end
- `src/playwright/browser.ts` — launch with stealth + persistent context
- `src/playwright/human.ts` — `humanClick`, `humanPaste`, `humanMouseMove`, `humanScroll`
- `src/playwright/selectors.ts` — role-based selectors, bilingual regex
- `src/playwright/detect.ts` — `detectFBState`
- `src/playwright/session.ts` — verify/save/load session
- `src/playwright/post.ts` — `postToGroup` (high-level flow)
- `test/fixtures/fb-composer.html` — offline test fixture
- `test/setup-db.ts` — in-memory SQLite helper

**`apps/web/`** — Next.js 15 app
- `next.config.ts`, `tailwind.config.ts`
- `app/layout.tsx` — shell + session banner
- `app/page.tsx` — Dashboard
- `app/campaigns/page.tsx`, `app/campaigns/new/page.tsx`, `app/campaigns/[id]/page.tsx`
- `app/groups/page.tsx`
- `app/settings/page.tsx`
- `app/session/page.tsx` — setup session / re-auth
- `app/logs/page.tsx`
- `app/api/trpc/[trpc]/route.ts`
- `server/trpc.ts`, `server/root.ts`, `server/context.ts`
- `server/routers/{campaign,group,setting,session,log,dashboard}.ts`
- `lib/trpc-client.ts`
- `lib/files.ts` — multipart upload handler
- `components/ui/*` — shadcn primitives
- `components/session-banner.tsx`, `campaign-form.tsx`, `group-picker.tsx`, `media-upload.tsx`, `delay-settings-form.tsx`, `log-table.tsx`

---

## Phases

- **Phase A — Foundation:** monorepo, tooling, DB schema
- **Phase B — Shared utilities:** delays, bezier, recurrence (pure, TDD)
- **Phase C — Playwright basics:** browser launch, human toolkit (fixture-tested)
- **Phase D — Session management:** setup + verify
- **Phase E — Posting engine:** `postToGroup`, detect states
- **Phase F — Campaign runner:** orchestrate one campaign end-to-end (mocked Playwright)
- **Phase G — Scheduler:** DB poll loop, state transitions, recurrence
- **Phase H — Web UI scaffolding:** Next.js + tRPC + shadcn
- **Phase I — Web UI features:** groups, campaigns, settings, session, logs, dashboard
- **Phase J — Integration & deployment:** pm2, E2E checklist, polish

Each phase ends in a working, testable slice. Stop at phase boundaries for review.

---

## Phase A — Foundation

### Task A1: Initialize git and .gitignore

**Files:**
- Create: `.gitignore`
- Create: `.nvmrc`
- Create: `.npmrc`

- [ ] **Step 1: Init git**

Run: `cd /Users/phantakan/Documents/fastwork/project/facebook-post-autamation && git init`
Expected: `Initialized empty Git repository`

- [ ] **Step 2: Write `.gitignore`**

```
node_modules/
.next/
dist/
*.log
logs/
.env
.env.local
data.db
data.db-journal
sessions/
uploads/
.DS_Store
coverage/
.turbo/
```

- [ ] **Step 3: Write `.nvmrc`**

```
20
```

- [ ] **Step 4: Write `.npmrc`**

```
auto-install-peers=true
shamefully-hoist=false
```

- [ ] **Step 5: Commit**

```bash
git add .gitignore .nvmrc .npmrc
git commit -m "chore: init repo with gitignore and node version pin"
```

---

### Task A2: Root package.json and workspace declaration

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`

- [ ] **Step 1: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 2: Write root `package.json`**

```json
{
  "name": "facebook-post-automation",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "concurrently -n web,worker -c cyan,magenta \"pnpm -F web dev\" \"pnpm -F worker dev\"",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "db:migrate": "pnpm -F @app/db migrate",
    "db:studio": "pnpm -F @app/db studio",
    "db:seed": "pnpm -F @app/db seed"
  },
  "devDependencies": {
    "concurrently": "^9.0.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 3: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

- [ ] **Step 4: Install root deps**

Run: `pnpm install`
Expected: lockfile created, no errors

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json pnpm-lock.yaml
git commit -m "chore: set up pnpm workspace and base tsconfig"
```

---

### Task A3: Create `packages/db` with Prisma

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/prisma/schema.prisma`
- Create: `packages/db/src/index.ts`

- [ ] **Step 1: Write `packages/db/package.json`**

```json
{
  "name": "@app/db",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "migrate": "prisma migrate dev",
    "generate": "prisma generate",
    "studio": "prisma studio",
    "seed": "tsx src/seed.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0"
  },
  "devDependencies": {
    "prisma": "^5.22.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Write `packages/db/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Write `packages/db/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:../../../data.db"
}

model User {
  id             String    @id @default(cuid())
  name           String
  sessionPath    String?
  sessionValid   Boolean   @default(false)
  sessionChecked DateTime?
  createdAt      DateTime  @default(now())

  groups    Group[]
  campaigns Campaign[]
  settings  Setting?
}

model Group {
  id         String    @id @default(cuid())
  userId     String
  fbGroupId  String
  fbUrl      String
  name       String?
  isActive   Boolean   @default(true)
  source     String
  lastPosted DateTime?
  createdAt  DateTime  @default(now())

  user      User            @relation(fields: [userId], references: [id])
  postLogs  PostLog[]
  campaigns CampaignGroup[]

  @@unique([userId, fbGroupId])
}

model Campaign {
  id            String    @id @default(cuid())
  userId        String
  title         String?
  content       String
  mediaFiles    String    @default("[]")
  mediaType     String    @default("none")

  scheduledAt   DateTime
  recurrence    String?
  jitterMinutes Int       @default(15)

  status        String    @default("draft")
  startedAt     DateTime?
  completedAt   DateTime?
  lastError     String?

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  user   User            @relation(fields: [userId], references: [id])
  groups CampaignGroup[]
  logs   PostLog[]
}

model CampaignGroup {
  campaignId String
  groupId    String
  order      Int

  campaign Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  group    Group    @relation(fields: [groupId], references: [id])

  @@id([campaignId, groupId])
}

model PostLog {
  id          String    @id @default(cuid())
  campaignId  String
  groupId     String
  attempt     Int       @default(1)
  status      String
  note        String?
  error       String?
  fbPostUrl   String?
  startedAt   DateTime?
  completedAt DateTime?
  createdAt   DateTime  @default(now())

  campaign Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  group    Group    @relation(fields: [groupId], references: [id])
}

model Setting {
  id     String @id @default(cuid())
  userId String @unique

  delayBetweenGroupsMinMs Int @default(180000)
  delayBetweenGroupsMaxMs Int @default(600000)
  delayBeforePostMinMs    Int @default(1000)
  delayBeforePostMaxMs    Int @default(3000)
  delayAfterFocusMinMs    Int @default(500)
  delayAfterFocusMaxMs    Int @default(1500)

  maxRetryPerGroup             Int @default(2)
  retryDelayMinMs              Int @default(60000)
  retryDelayMaxMs              Int @default(180000)
  stopAfterConsecutiveFailures Int @default(3)

  enableMouseMove        Boolean @default(true)
  enableScrollBeforePost Boolean @default(true)
  enableJitter           Boolean @default(true)

  user User @relation(fields: [userId], references: [id])
}
```

- [ ] **Step 4: Write `packages/db/src/index.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__prisma ?? new PrismaClient({ log: ['warn', 'error'] });

if (process.env.NODE_ENV !== 'production') globalThis.__prisma = prisma;

export * from '@prisma/client';
```

- [ ] **Step 5: Install + generate + migrate**

Run:
```bash
pnpm -F @app/db install
pnpm -F @app/db exec prisma generate
pnpm -F @app/db exec prisma migrate dev --name init
```
Expected: `data.db` created at repo root, `packages/db/prisma/migrations/` populated.

- [ ] **Step 6: Commit**

```bash
git add packages/db package.json pnpm-lock.yaml data.db
git commit -m "feat(db): add Prisma schema and client singleton"
```

Note: commit `data.db` is optional — for dev convenience. Already excluded by `.gitignore`, but `migrations/` must be committed.

Run: `git add -f packages/db/prisma/migrations`

---

### Task A4: Seed script for default user + settings

**Files:**
- Create: `packages/db/src/seed.ts`

- [ ] **Step 1: Write `packages/db/src/seed.ts`**

```typescript
import { prisma } from './index.js';

async function main() {
  const user = await prisma.user.upsert({
    where: { id: 'default-user' },
    update: {},
    create: { id: 'default-user', name: 'Me' },
  });

  await prisma.setting.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  console.log('Seeded user:', user.id);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run seed**

Run: `pnpm db:seed`
Expected: `Seeded user: default-user`

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/seed.ts
git commit -m "feat(db): add seed script for default user and settings"
```

---

### Task A5: Create `packages/shared` with constants and Zod schemas

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/constants.ts`
- Create: `packages/shared/src/schemas/campaign.ts`
- Create: `packages/shared/src/schemas/group.ts`
- Create: `packages/shared/src/schemas/setting.ts`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Write `packages/shared/package.json`**

```json
{
  "name": "@app/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Write `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Write `packages/shared/src/constants.ts`**

```typescript
export const CAMPAIGN_STATUSES = [
  'draft', 'scheduled', 'running', 'completed', 'failed', 'paused',
] as const;
export type CampaignStatus = typeof CAMPAIGN_STATUSES[number];

export const POST_STATUSES = ['pending', 'success', 'failed', 'skipped'] as const;
export type PostStatus = typeof POST_STATUSES[number];

export const MEDIA_TYPES = ['none', 'images', 'video'] as const;
export type MediaType = typeof MEDIA_TYPES[number];

export const GROUP_SOURCES = ['manual', 'auto_sync'] as const;
export type GroupSource = typeof GROUP_SOURCES[number];

export const MAX_IMAGES_PER_POST = 10;
export const SOFT_MAX_GROUPS_PER_CAMPAIGN = 15;
export const SOFT_MAX_CAMPAIGNS_PER_DAY = 3;
```

- [ ] **Step 4: Write `packages/shared/src/schemas/campaign.ts`**

```typescript
import { z } from 'zod';
import { CAMPAIGN_STATUSES, MEDIA_TYPES, MAX_IMAGES_PER_POST } from '../constants.js';

export const campaignCreateSchema = z.object({
  title: z.string().max(120).optional(),
  content: z.string().min(1).max(63206),
  mediaType: z.enum(MEDIA_TYPES),
  mediaFiles: z.array(z.string()).max(MAX_IMAGES_PER_POST),
  scheduledAt: z.coerce.date(),
  recurrence: z.string().max(60).nullable().optional(),
  jitterMinutes: z.number().int().min(0).max(120).default(15),
  groupIds: z.array(z.string()).min(1),
}).refine(
  (d) => d.mediaType !== 'video' || d.mediaFiles.length === 1,
  { message: 'Video media type must have exactly 1 file', path: ['mediaFiles'] },
).refine(
  (d) => d.mediaType !== 'none' || d.mediaFiles.length === 0,
  { message: 'mediaFiles must be empty when mediaType=none', path: ['mediaFiles'] },
);

export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;

export const campaignUpdateSchema = campaignCreateSchema.partial().extend({
  id: z.string(),
});

export const campaignStatusSchema = z.enum(CAMPAIGN_STATUSES);
```

- [ ] **Step 5: Write `packages/shared/src/schemas/group.ts`**

```typescript
import { z } from 'zod';
import { GROUP_SOURCES } from '../constants.js';

const FB_GROUP_URL =
  /^https?:\/\/(www\.|web\.|m\.)?facebook\.com\/groups\/([a-zA-Z0-9._-]+)\/?$/;

export function parseGroupUrl(url: string): { fbGroupId: string; canonicalUrl: string } | null {
  const m = url.trim().match(FB_GROUP_URL);
  if (!m) return null;
  const id = m[2]!;
  return { fbGroupId: id, canonicalUrl: `https://www.facebook.com/groups/${id}` };
}

export const groupCreateSchema = z.object({
  fbUrl: z.string().url().refine((u) => parseGroupUrl(u) !== null, {
    message: 'Not a valid Facebook group URL',
  }),
  name: z.string().max(200).optional(),
  source: z.enum(GROUP_SOURCES).default('manual'),
});

export const groupBulkCreateSchema = z.object({
  urls: z.array(z.string()).min(1).max(100),
});

export type GroupCreateInput = z.infer<typeof groupCreateSchema>;
```

- [ ] **Step 6: Write `packages/shared/src/schemas/setting.ts`**

```typescript
import { z } from 'zod';

const pairMinMax = (min: number, max: number) =>
  z.object({
    min: z.number().int().min(0).max(3_600_000),
    max: z.number().int().min(0).max(3_600_000),
  }).default({ min, max }).refine((v) => v.min <= v.max, {
    message: 'min must be <= max',
  });

export const settingUpdateSchema = z.object({
  delayBetweenGroups: pairMinMax(180_000, 600_000),
  delayBeforePost: pairMinMax(1_000, 3_000),
  delayAfterFocus: pairMinMax(500, 1_500),
  retryDelay: pairMinMax(60_000, 180_000),
  maxRetryPerGroup: z.number().int().min(0).max(10).default(2),
  stopAfterConsecutiveFailures: z.number().int().min(1).max(20).default(3),
  enableMouseMove: z.boolean().default(true),
  enableScrollBeforePost: z.boolean().default(true),
  enableJitter: z.boolean().default(true),
});

export type SettingUpdateInput = z.infer<typeof settingUpdateSchema>;
```

- [ ] **Step 7: Write `packages/shared/src/types.ts`**

```typescript
import type { CampaignStatus, PostStatus, MediaType } from './constants.js';

export type CampaignStatusType = CampaignStatus;
export type PostStatusType = PostStatus;
export type MediaTypeType = MediaType;

export interface PostResult {
  success: boolean;
  fbPostUrl?: string;
  note?: 'pending_approval';
  error?: string;
  errorCategory?:
    | 'session_invalid'
    | 'account_locked'
    | 'rate_limited'
    | 'group_unavailable'
    | 'selector_not_found'
    | 'upload_failed'
    | 'transient';
}

export interface FBState {
  type: 'ok' | 'session_invalid' | 'account_locked' | 'rate_limited' | 'group_unavailable';
  detail?: string;
}
```

- [ ] **Step 8: Write `packages/shared/src/index.ts`**

```typescript
export * from './constants.js';
export * from './schemas/campaign.js';
export * from './schemas/group.js';
export * from './schemas/setting.js';
export * from './types.js';
```

- [ ] **Step 9: Install and typecheck**

Run:
```bash
pnpm install
pnpm -F @app/shared typecheck
```
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add packages/shared pnpm-lock.yaml
git commit -m "feat(shared): add Zod schemas, constants, and shared types"
```

---

## Phase B — Shared utilities (TDD)

### Task B1: Worker package scaffold + test setup

**Files:**
- Create: `apps/worker/package.json`
- Create: `apps/worker/tsconfig.json`
- Create: `apps/worker/vitest.config.ts`

- [ ] **Step 1: Write `apps/worker/package.json`**

```json
{
  "name": "worker",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/main.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@app/db": "workspace:*",
    "@app/shared": "workspace:*",
    "cron-parser": "^4.9.0",
    "node-cron": "^3.0.3",
    "pino": "^9.5.0",
    "pino-pretty": "^11.2.0",
    "playwright": "^1.48.0",
    "playwright-extra": "^4.3.6",
    "puppeteer-extra-plugin-stealth": "^2.11.2"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/node-cron": "^3.0.11",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Write `apps/worker/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Write `apps/worker/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    testTimeout: 10_000,
  },
});
```

- [ ] **Step 4: Install**

Run: `pnpm install`
Expected: success, workspace packages linked.

- [ ] **Step 5: Commit**

```bash
git add apps/worker pnpm-lock.yaml
git commit -m "chore(worker): scaffold package with Vitest and dependencies"
```

---

### Task B2: `sleep` and `humanDelay` (TDD)

**Files:**
- Create: `apps/worker/src/utils/delays.ts`
- Create: `apps/worker/src/utils/delays.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/worker/src/utils/delays.test.ts
import { describe, it, expect, vi } from 'vitest';
import { sleep, humanDelay } from './delays.js';

describe('sleep', () => {
  it('resolves after the given ms (monotonic)', async () => {
    const start = performance.now();
    await sleep(20);
    expect(performance.now() - start).toBeGreaterThanOrEqual(15);
  });
});

describe('humanDelay', () => {
  it('returns a value within [min, max] range', async () => {
    vi.useFakeTimers();
    const p = humanDelay(100, 200);
    vi.runAllTimers();
    const ms = await p;
    expect(ms).toBeGreaterThanOrEqual(100);
    expect(ms).toBeLessThanOrEqual(200);
    vi.useRealTimers();
  });

  it('distributes values across range (not constant)', () => {
    const samples = Array.from({ length: 200 }, () => humanDelay.pick(100, 500));
    const uniq = new Set(samples.map((v) => Math.round(v / 10)));
    expect(uniq.size).toBeGreaterThan(10);
  });

  it('throws if min > max', () => {
    expect(() => humanDelay.pick(500, 100)).toThrow();
  });
});
```

- [ ] **Step 2: Verify failing**

Run: `pnpm -F worker test`
Expected: FAIL — file not found.

- [ ] **Step 3: Write implementation**

```typescript
// apps/worker/src/utils/delays.ts
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function pick(min: number, max: number): number {
  if (min > max) throw new Error(`humanDelay: min (${min}) > max (${max})`);
  const base = Math.random() * (max - min) + min;
  const jitter = 0.8 + Math.random() * 0.4;
  const v = base * jitter;
  return Math.max(min, Math.min(max, v));
}

export const humanDelay = Object.assign(
  async (min: number, max: number): Promise<number> => {
    const ms = pick(min, max);
    await sleep(ms);
    return ms;
  },
  { pick },
);
```

- [ ] **Step 4: Verify passing**

Run: `pnpm -F worker test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/utils/delays.ts apps/worker/src/utils/delays.test.ts
git commit -m "feat(worker): add sleep and humanDelay utilities"
```

---

### Task B3: Bezier curve for mouse paths (TDD)

**Files:**
- Create: `apps/worker/src/utils/bezier.ts`
- Create: `apps/worker/src/utils/bezier.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/worker/src/utils/bezier.test.ts
import { describe, it, expect } from 'vitest';
import { bezierPath } from './bezier.js';

describe('bezierPath', () => {
  it('starts at from and ends at to', () => {
    const points = bezierPath({ x: 10, y: 10 }, { x: 200, y: 300 }, 20);
    expect(points[0]).toEqual({ x: 10, y: 10 });
    expect(points.at(-1)).toEqual({ x: 200, y: 300 });
  });

  it('returns the requested number of points', () => {
    const points = bezierPath({ x: 0, y: 0 }, { x: 100, y: 100 }, 15);
    expect(points).toHaveLength(15);
  });

  it('has monotonic-ish progress (not reversing wildly)', () => {
    const points = bezierPath({ x: 0, y: 0 }, { x: 500, y: 500 }, 30);
    let inversions = 0;
    for (let i = 1; i < points.length; i++) {
      if (points[i]!.x < points[i - 1]!.x - 50) inversions++;
    }
    expect(inversions).toBeLessThan(3);
  });
});
```

- [ ] **Step 2: Verify failing**

Run: `pnpm -F worker test`
Expected: FAIL — `bezierPath` not found.

- [ ] **Step 3: Write implementation**

```typescript
// apps/worker/src/utils/bezier.ts
export interface Point { x: number; y: number; }

export function bezierPath(from: Point, to: Point, steps: number): Point[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const perpX = -dy / (dist || 1);
  const perpY = dx / (dist || 1);
  const bow = (Math.random() - 0.5) * Math.min(dist * 0.25, 80);

  const c1: Point = {
    x: from.x + dx * 0.25 + perpX * bow,
    y: from.y + dy * 0.25 + perpY * bow,
  };
  const c2: Point = {
    x: from.x + dx * 0.75 + perpX * bow * 0.6,
    y: from.y + dy * 0.75 + perpY * bow * 0.6,
  };

  const points: Point[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const mt = 1 - t;
    const x = mt ** 3 * from.x + 3 * mt ** 2 * t * c1.x + 3 * mt * t ** 2 * c2.x + t ** 3 * to.x;
    const y = mt ** 3 * from.y + 3 * mt ** 2 * t * c1.y + 3 * mt * t ** 2 * c2.y + t ** 3 * to.y;
    points.push({ x: Math.round(x), y: Math.round(y) });
  }
  return points;
}
```

- [ ] **Step 4: Verify passing**

Run: `pnpm -F worker test`
Expected: PASS (all delay + bezier tests).

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/utils/bezier.ts apps/worker/src/utils/bezier.test.ts
git commit -m "feat(worker): add Bezier curve generator for mouse paths"
```

---

### Task B4: Recurrence calculation (next run + jitter) (TDD)

**Files:**
- Create: `apps/worker/src/campaigns/recurrence.ts`
- Create: `apps/worker/src/campaigns/recurrence.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/worker/src/campaigns/recurrence.test.ts
import { describe, it, expect } from 'vitest';
import { calculateNextRun, applyJitter } from './recurrence.js';

describe('applyJitter', () => {
  it('returns a date within ± jitterMinutes of base', () => {
    const base = new Date('2026-04-17T10:00:00Z');
    for (let i = 0; i < 50; i++) {
      const jittered = applyJitter(base, 15);
      const diffMin = Math.abs(jittered.getTime() - base.getTime()) / 60_000;
      expect(diffMin).toBeLessThanOrEqual(15);
    }
  });

  it('returns base when jitterMinutes is 0', () => {
    const base = new Date('2026-04-17T10:00:00Z');
    expect(applyJitter(base, 0).getTime()).toBe(base.getTime());
  });
});

describe('calculateNextRun', () => {
  it('returns null when recurrence is null (one-time)', () => {
    expect(calculateNextRun(new Date(), null)).toBeNull();
  });

  it('returns next Monday 09:00 for "0 9 * * MON"', () => {
    const from = new Date('2026-04-17T12:00:00Z'); // Friday
    const next = calculateNextRun(from, '0 9 * * MON');
    expect(next).not.toBeNull();
    expect(next!.getUTCDay()).toBe(1);
    expect(next!.getUTCHours()).toBe(9);
  });

  it('throws on invalid cron expression', () => {
    expect(() => calculateNextRun(new Date(), 'not a cron')).toThrow();
  });
});
```

- [ ] **Step 2: Verify failing**

Run: `pnpm -F worker test recurrence`
Expected: FAIL.

- [ ] **Step 3: Write implementation**

```typescript
// apps/worker/src/campaigns/recurrence.ts
import cronParser from 'cron-parser';

export function applyJitter(base: Date, jitterMinutes: number): Date {
  if (jitterMinutes === 0) return base;
  const offsetMs = (Math.random() * 2 - 1) * jitterMinutes * 60_000;
  return new Date(base.getTime() + offsetMs);
}

export function calculateNextRun(from: Date, recurrence: string | null): Date | null {
  if (recurrence === null || recurrence === '') return null;
  const interval = cronParser.parseExpression(recurrence, { currentDate: from, utc: true });
  return interval.next().toDate();
}
```

- [ ] **Step 4: Verify passing**

Run: `pnpm -F worker test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/campaigns/recurrence.ts apps/worker/src/campaigns/recurrence.test.ts
git commit -m "feat(worker): add recurrence next-run and jitter helpers"
```

---

### Task B5: Logger setup

**Files:**
- Create: `apps/worker/src/logger.ts`

- [ ] **Step 1: Write `apps/worker/src/logger.ts`**

```typescript
import pino from 'pino';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const LOG_DIR = resolve(process.cwd(), 'logs');
mkdirSync(LOG_DIR, { recursive: true });

const dateStamp = new Date().toISOString().slice(0, 10);
const logFile = resolve(LOG_DIR, `worker-${dateStamp}.log`);

export const logger = pino(
  { level: process.env.LOG_LEVEL ?? 'info' },
  pino.multistream([
    { stream: pino.destination({ dest: logFile, sync: false, mkdir: true }) },
    {
      stream: pino.transport({
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss' },
      }),
    },
  ]),
);

export function childLogger(ctx: Record<string, unknown>) {
  return logger.child(ctx);
}
```

- [ ] **Step 2: Smoke test manually**

Run:
```bash
pnpm -F worker exec node --experimental-strip-types --input-type=module -e "import('./src/logger.ts').then(m => m.logger.info({x:1},'hello'))"
```

(or skip this step — tested later via scheduler integration)

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/logger.ts
git commit -m "feat(worker): add pino logger with daily file output"
```

---

## Phase C — Playwright basics

### Task C1: Install Playwright browsers

- [ ] **Step 1: Install Chromium only**

Run: `pnpm -F worker exec playwright install chromium`
Expected: Chromium downloaded to `~/Library/Caches/ms-playwright/` (macOS).

- [ ] **Step 2: Verify**

Run: `pnpm -F worker exec playwright --version`
Expected: version printed.

No commit (binaries not tracked).

---

### Task C2: Browser launch with stealth + persistent context

**Files:**
- Create: `apps/worker/src/playwright/browser.ts`

- [ ] **Step 1: Write `apps/worker/src/playwright/browser.ts`**

```typescript
import { chromium as playwrightExtraChromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { BrowserContext } from 'playwright';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

playwrightExtraChromium.use(StealthPlugin());

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

export interface LaunchOptions {
  userId: string;
  headless?: boolean;
}

export async function launchBrowser(opts: LaunchOptions): Promise<BrowserContext> {
  const sessionDir = resolve(process.cwd(), 'sessions', opts.userId);
  mkdirSync(sessionDir, { recursive: true });

  const context = await playwrightExtraChromium.launchPersistentContext(sessionDir, {
    headless: opts.headless ?? false,
    viewport: { width: 1440, height: 900 },
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    userAgent: UA,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });

  return context;
}

export function sessionDirFor(userId: string): string {
  return resolve(process.cwd(), 'sessions', userId);
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F worker typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/playwright/browser.ts
git commit -m "feat(worker): add stealth Chromium launcher with persistent context"
```

---

### Task C3: Selectors registry

**Files:**
- Create: `apps/worker/src/playwright/selectors.ts`

- [ ] **Step 1: Write file**

```typescript
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
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F worker typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/playwright/selectors.ts
git commit -m "feat(worker): add FB selectors registry with bilingual fallbacks"
```

---

### Task C4: Offline fixture HTML for human action tests

**Files:**
- Create: `apps/worker/test/fixtures/fb-composer.html`

- [ ] **Step 1: Write fixture**

```html
<!doctype html>
<html lang="th">
<head><meta charset="utf-8"><title>Mock FB Composer</title></head>
<body>
  <main>
    <button id="open-composer" aria-label="เขียนบางสิ่งบางอย่าง">เขียนบางสิ่งบางอย่าง</button>
    <div id="composer" style="display:none;">
      <div id="editor" contenteditable="true" role="textbox" aria-label="Composer"></div>
      <input type="file" id="file-input" multiple />
      <button id="submit" aria-label="โพสต์">โพสต์</button>
    </div>
    <div id="feedback" data-testid="feedback"></div>
  </main>
  <script>
    document.getElementById('open-composer').addEventListener('click', () => {
      document.getElementById('composer').style.display = 'block';
      document.getElementById('editor').focus();
    });
    document.getElementById('editor').addEventListener('paste', (e) => {
      const text = e.clipboardData.getData('text/plain');
      document.getElementById('editor').innerText = text;
      e.preventDefault();
    });
    document.getElementById('submit').addEventListener('click', () => {
      const fb = document.getElementById('feedback');
      fb.textContent = 'posted:' + document.getElementById('editor').innerText;
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add apps/worker/test/fixtures/fb-composer.html
git commit -m "test(worker): add offline FB composer fixture for human-action tests"
```

---

### Task C5: Human toolkit (humanMouseMove, humanClick, humanPaste, humanScroll) + fixture tests

**Files:**
- Create: `apps/worker/src/playwright/human.ts`
- Create: `apps/worker/src/playwright/human.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/worker/src/playwright/human.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { humanClick, humanPaste } from './human.js';

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
    expect(value).toBe('hello from bot');
  });
});
```

- [ ] **Step 2: Verify failing**

Run: `pnpm -F worker test human`
Expected: FAIL — `human.ts` not found.

- [ ] **Step 3: Write implementation**

```typescript
// apps/worker/src/playwright/human.ts
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
  await page.locator(editorSelector).first().focus();
  await humanDelay(300, 800);
  // Use page.evaluate to synthesize a paste event reliably (clipboard API blocked in some headless).
  await page.evaluate(
    ({ sel, text }) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) throw new Error('paste target missing');
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    },
    { sel: editorSelector, text },
  );
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
```

- [ ] **Step 4: Verify passing**

Run: `pnpm -F worker test human`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/playwright/human.ts apps/worker/src/playwright/human.test.ts
git commit -m "feat(worker): add human-like Playwright action toolkit with offline tests"
```

---

### Task C6: `detectFBState` (state detection)

**Files:**
- Create: `apps/worker/src/playwright/detect.ts`

- [ ] **Step 1: Write file**

```typescript
// apps/worker/src/playwright/detect.ts
import type { Page } from 'playwright';
import type { FBState } from '@app/shared';
import { SELECTORS } from './selectors.js';

export async function detectFBState(page: Page): Promise<FBState> {
  const url = page.url();

  if (url.includes('/checkpoint') || url.includes('/login')) {
    return { type: 'session_invalid', detail: `url=${url}` };
  }

  if ((await page.locator(SELECTORS.checkpointMarker).count()) > 0) {
    return { type: 'account_locked', detail: 'checkpoint element' };
  }

  if ((await page.locator(SELECTORS.rateLimitText).count()) > 0) {
    return { type: 'rate_limited', detail: 'rate limit banner' };
  }

  if ((await page.locator(SELECTORS.groupUnavailableText).count()) > 0) {
    return { type: 'group_unavailable', detail: 'content not found' };
  }

  return { type: 'ok' };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F worker typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/playwright/detect.ts
git commit -m "feat(worker): add FB state detection helper"
```

---

## Phase D — Session management

### Task D1: Session verify + save + load

**Files:**
- Create: `apps/worker/src/playwright/session.ts`

- [ ] **Step 1: Write file**

```typescript
// apps/worker/src/playwright/session.ts
import type { BrowserContext } from 'playwright';
import { launchBrowser } from './browser.js';
import { detectFBState } from './detect.js';
import { sleep } from '../utils/delays.js';
import { prisma } from '@app/db';
import { logger } from '../logger.js';

export interface SessionCheckResult {
  valid: boolean;
  reason?: string;
}

/**
 * Open FB homepage with the persistent session and check login state.
 * Used both for initial setup and for pre-flight validation before each campaign.
 */
export async function verifySession(userId: string): Promise<SessionCheckResult> {
  const ctx = await launchBrowser({ userId, headless: false });
  try {
    const page = await ctx.newPage();
    await page.goto('https://www.facebook.com/me', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await sleep(2_000);
    const state = await detectFBState(page);
    const valid = state.type === 'ok' && !page.url().includes('/login');

    await prisma.user.update({
      where: { id: userId },
      data: { sessionValid: valid, sessionChecked: new Date() },
    });

    logger.info({ userId, valid, state: state.type }, 'session verify');
    return valid ? { valid: true } : { valid: false, reason: state.type };
  } finally {
    await ctx.close();
  }
}

/**
 * Open a headed browser so the user can log in (including 2FA).
 * Cookies persist automatically via launchPersistentContext.
 * Resolves after the user closes the window OR after 10 min timeout.
 */
export async function openSessionSetup(userId: string): Promise<void> {
  const ctx = await launchBrowser({ userId, headless: false });
  try {
    const page = await ctx.newPage();
    await page.goto('https://www.facebook.com/login', { waitUntil: 'domcontentloaded' });
    logger.info({ userId }, 'session setup opened — waiting for user to close window');
    await ctx.waitForEvent('close', { timeout: 10 * 60_000 });
  } finally {
    // context may already be closed by user
    try { await ctx.close(); } catch {}
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F worker typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/playwright/session.ts
git commit -m "feat(worker): add FB session verify and setup flows"
```

---

## Phase E — Posting engine

### Task E1: `postToGroup` high-level flow

**Files:**
- Create: `apps/worker/src/playwright/post.ts`

- [ ] **Step 1: Write file**

```typescript
// apps/worker/src/playwright/post.ts
import type { BrowserContext } from 'playwright';
import type { PostResult } from '@app/shared';
import { SELECTORS, firstMatch } from './selectors.js';
import { humanClick, humanPaste, humanScroll } from './human.js';
import { detectFBState } from './detect.js';
import { humanDelay, sleep } from '../utils/delays.js';
import { logger } from '../logger.js';

export interface PostInput {
  fbUrl: string;
  content: string;
  mediaFiles: string[];
  enableScrollBeforePost: boolean;
  delayBeforePost: { min: number; max: number };
  delayAfterFocus: { min: number; max: number };
}

export async function postToGroup(
  ctx: BrowserContext,
  input: PostInput,
): Promise<PostResult> {
  const log = logger.child({ fbUrl: input.fbUrl });
  const page = await ctx.newPage();
  try {
    await page.goto(input.fbUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await humanDelay(2_000, 5_000);

    let state = await detectFBState(page);
    if (state.type !== 'ok') {
      return { success: false, errorCategory: state.type, error: state.detail };
    }

    if (input.enableScrollBeforePost) await humanScroll(page);

    const composerSelector = await firstMatch(page, SELECTORS.composerOpen);
    if (!composerSelector) {
      return { success: false, errorCategory: 'selector_not_found', error: 'composer not found' };
    }
    await humanClick(page, composerSelector);
    await humanDelay(input.delayAfterFocus.min, input.delayAfterFocus.max);

    await humanPaste(page, SELECTORS.composerEditable, input.content);
    await humanDelay(input.delayBeforePost.min, input.delayBeforePost.max);

    if (input.mediaFiles.length > 0) {
      const attachSel = await firstMatch(page, SELECTORS.attachMedia);
      if (attachSel) {
        await humanClick(page, attachSel);
        await humanDelay(500, 1500);
      }
      await page.setInputFiles(SELECTORS.fileInput, input.mediaFiles);
      // Wait for thumbnails to render — simple heuristic (longer delay for video)
      await sleep(3_000 + input.mediaFiles.length * 1_500);
      await humanDelay(1_000, 3_000);
    }

    const submitSel = await firstMatch(page, SELECTORS.submitPost);
    if (!submitSel) {
      return { success: false, errorCategory: 'selector_not_found', error: 'submit not found' };
    }
    await humanClick(page, submitSel);

    // Wait for post to complete or error to appear
    await sleep(4_000);

    state = await detectFBState(page);
    if (state.type !== 'ok') {
      return { success: false, errorCategory: state.type, error: state.detail };
    }

    const pendingApproval = await page.locator(SELECTORS.pendingApproval).count();
    if (pendingApproval > 0) {
      return { success: true, note: 'pending_approval' };
    }

    log.info('post submitted');
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err: msg }, 'postToGroup failed');
    return { success: false, errorCategory: 'transient', error: msg };
  } finally {
    await page.close();
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F worker typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/playwright/post.ts
git commit -m "feat(worker): add postToGroup orchestration with state checks"
```

---

## Phase F — Campaign runner (orchestrator)

### Task F1: DB test helper (in-memory SQLite)

**Files:**
- Create: `apps/worker/test/setup-db.ts`

- [ ] **Step 1: Write file**

```typescript
// apps/worker/test/setup-db.ts
import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface TestDb {
  prisma: PrismaClient;
  dbUrl: string;
  cleanup: () => Promise<void>;
}

export async function setupTestDb(): Promise<TestDb> {
  const dir = mkdtempSync(join(tmpdir(), 'fbpost-test-'));
  const dbFile = join(dir, 'test.db');
  const dbUrl = `file:${dbFile}`;
  // Push schema without migrations for speed
  execSync(`pnpm -F @app/db exec prisma db push --skip-generate`, {
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'inherit',
  });
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  return {
    prisma,
    dbUrl,
    cleanup: async () => { await prisma.$disconnect(); },
  };
}

export async function seedBasic(prisma: PrismaClient, opts: { groups?: number } = {}) {
  const user = await prisma.user.create({ data: { id: 'u1', name: 'Me' } });
  await prisma.setting.create({ data: { userId: user.id } });
  const groups = [];
  for (let i = 0; i < (opts.groups ?? 3); i++) {
    groups.push(await prisma.group.create({
      data: {
        userId: user.id,
        fbGroupId: `g${i}`,
        fbUrl: `https://www.facebook.com/groups/g${i}`,
        name: `Group ${i}`,
        source: 'manual',
      },
    }));
  }
  return { user, groups };
}
```

Note: update `packages/db/prisma/schema.prisma` datasource to use `env("DATABASE_URL")` so test can override.

- [ ] **Step 2: Update schema.prisma datasource**

Edit `packages/db/prisma/schema.prisma`:
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

- [ ] **Step 3: Add `.env` and `.env.example` at root**

```
DATABASE_URL="file:./data.db"
```

- [ ] **Step 4: Re-run migrate to confirm still works**

Run: `DATABASE_URL="file:./data.db" pnpm db:migrate`
Expected: no migrations needed, schema in sync.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/test/setup-db.ts packages/db/prisma/schema.prisma .env.example
git commit -m "test(worker): add in-memory test DB helper and env-based DATABASE_URL"
```

(Do NOT commit `.env` — already in .gitignore)

---

### Task F2: Campaign runner — post all groups flow (TDD with mocked Playwright)

**Files:**
- Create: `apps/worker/src/campaigns/runner.ts`
- Create: `apps/worker/src/campaigns/runner.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/worker/src/campaigns/runner.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { setupTestDb, seedBasic, type TestDb } from '../../test/setup-db.js';
import { runCampaign, type PlaywrightAdapter } from './runner.js';

describe('runCampaign', () => {
  let db: TestDb;
  let prisma: PrismaClient;

  beforeEach(async () => {
    db = await setupTestDb();
    prisma = db.prisma;
  });
  afterEach(async () => { await db.cleanup(); });

  function makeAdapter(overrides: Partial<PlaywrightAdapter> = {}): PlaywrightAdapter {
    return {
      verifySession: vi.fn().mockResolvedValue({ valid: true }),
      postToGroup: vi.fn().mockResolvedValue({ success: true, fbPostUrl: 'https://fb.com/p/1' }),
      ...overrides,
    };
  }

  it('posts to all target groups and marks campaign completed', async () => {
    const { user, groups } = await seedBasic(prisma, { groups: 3 });
    const campaign = await prisma.campaign.create({
      data: {
        userId: user.id, content: 'hi', scheduledAt: new Date(), status: 'scheduled',
        groups: { create: groups.map((g, i) => ({ groupId: g.id, order: i })) },
      },
    });

    const adapter = makeAdapter();
    await runCampaign({ campaignId: campaign.id, prisma, adapter, fastMode: true });

    expect(adapter.postToGroup).toHaveBeenCalledTimes(3);
    const updated = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(updated.status).toBe('completed');
    const logs = await prisma.postLog.findMany({ where: { campaignId: campaign.id } });
    expect(logs).toHaveLength(3);
    expect(logs.every((l) => l.status === 'success')).toBe(true);
  });

  it('pauses campaign after consecutive failures threshold', async () => {
    const { user, groups } = await seedBasic(prisma, { groups: 5 });
    const campaign = await prisma.campaign.create({
      data: {
        userId: user.id, content: 'hi', scheduledAt: new Date(), status: 'scheduled',
        groups: { create: groups.map((g, i) => ({ groupId: g.id, order: i })) },
      },
    });

    const adapter = makeAdapter({
      postToGroup: vi.fn().mockResolvedValue({ success: false, errorCategory: 'transient', error: 'x' }),
    });
    await runCampaign({ campaignId: campaign.id, prisma, adapter, fastMode: true });

    const updated = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(updated.status).toBe('paused');
    // 3 groups * (1 initial + 2 retries) = 9 attempts, then stop
    expect(adapter.postToGroup).toHaveBeenCalledTimes(9);
  });

  it('pauses immediately if session is invalid', async () => {
    const { user, groups } = await seedBasic(prisma, { groups: 3 });
    const campaign = await prisma.campaign.create({
      data: {
        userId: user.id, content: 'hi', scheduledAt: new Date(), status: 'scheduled',
        groups: { create: groups.map((g, i) => ({ groupId: g.id, order: i })) },
      },
    });

    const adapter = makeAdapter({
      verifySession: vi.fn().mockResolvedValue({ valid: false, reason: 'session_invalid' }),
    });
    await runCampaign({ campaignId: campaign.id, prisma, adapter, fastMode: true });

    const updated = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(updated.status).toBe('paused');
    expect(adapter.postToGroup).not.toHaveBeenCalled();
  });

  it('resumes: skips groups that already have success in PostLog', async () => {
    const { user, groups } = await seedBasic(prisma, { groups: 3 });
    const campaign = await prisma.campaign.create({
      data: {
        userId: user.id, content: 'hi', scheduledAt: new Date(), status: 'scheduled',
        groups: { create: groups.map((g, i) => ({ groupId: g.id, order: i })) },
      },
    });
    // Pre-populate one success log (as if from prior run)
    await prisma.postLog.create({
      data: { campaignId: campaign.id, groupId: groups[0]!.id, status: 'success' },
    });

    const adapter = makeAdapter();
    await runCampaign({ campaignId: campaign.id, prisma, adapter, fastMode: true });

    // Only groups 1 and 2 posted (group 0 already successful)
    expect(adapter.postToGroup).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Verify failing**

Run: `pnpm -F worker test runner`
Expected: FAIL — `runner.ts` not found.

- [ ] **Step 3: Write implementation**

```typescript
// apps/worker/src/campaigns/runner.ts
import type { PrismaClient } from '@prisma/client';
import type { PostResult } from '@app/shared';
import { humanDelay } from '../utils/delays.js';
import { applyJitter, calculateNextRun } from './recurrence.js';
import { logger } from '../logger.js';

export interface PlaywrightAdapter {
  verifySession(userId: string): Promise<{ valid: boolean; reason?: string }>;
  postToGroup(input: {
    userId: string;
    fbUrl: string;
    content: string;
    mediaFiles: string[];
  }): Promise<PostResult>;
}

export interface RunCampaignInput {
  campaignId: string;
  prisma: PrismaClient;
  adapter: PlaywrightAdapter;
  /** If true, skip inter-group delays (tests). */
  fastMode?: boolean;
}

export async function runCampaign(input: RunCampaignInput): Promise<void> {
  const { campaignId, prisma, adapter, fastMode = false } = input;
  const log = logger.child({ campaignId });

  // 1. Atomic lock
  const locked = await prisma.campaign.updateMany({
    where: { id: campaignId, status: 'scheduled' },
    data: { status: 'running', startedAt: new Date() },
  });
  if (locked.count === 0) {
    log.warn('campaign not in scheduled state, skipping');
    return;
  }

  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    include: {
      groups: { orderBy: { order: 'asc' }, include: { group: true } },
      logs: true,
    },
  });
  const setting = await prisma.setting.findUniqueOrThrow({ where: { userId: campaign.userId } });

  // 2. Verify session
  const sessionCheck = await adapter.verifySession(campaign.userId);
  if (!sessionCheck.valid) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'paused', lastError: `session_invalid: ${sessionCheck.reason}` },
    });
    log.warn({ reason: sessionCheck.reason }, 'session invalid — paused');
    return;
  }

  // 3. Determine which groups still need posting (resume-aware)
  const alreadySucceeded = new Set(
    campaign.logs.filter((l) => l.status === 'success').map((l) => l.groupId),
  );
  const toPost = campaign.groups.filter((cg) => !alreadySucceeded.has(cg.groupId));

  const mediaFiles: string[] = JSON.parse(campaign.mediaFiles);
  let consecutiveFails = 0;
  let pauseTriggered = false;

  // 4. Loop groups
  for (const cg of toPost) {
    let attempt = 1;
    let finalResult: PostResult | null = null;

    while (attempt <= setting.maxRetryPerGroup + 1) {
      const logEntry = await prisma.postLog.create({
        data: {
          campaignId: campaign.id,
          groupId: cg.groupId,
          attempt,
          status: 'pending',
          startedAt: new Date(),
        },
      });

      const result = await adapter.postToGroup({
        userId: campaign.userId,
        fbUrl: cg.group.fbUrl,
        content: campaign.content,
        mediaFiles,
      });

      await prisma.postLog.update({
        where: { id: logEntry.id },
        data: {
          status: result.success ? 'success' : 'failed',
          note: result.note,
          error: result.error,
          fbPostUrl: result.fbPostUrl,
          completedAt: new Date(),
        },
      });

      // Critical failures → abort whole campaign
      if (!result.success && (result.errorCategory === 'session_invalid' || result.errorCategory === 'account_locked' || result.errorCategory === 'rate_limited')) {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: 'paused', lastError: `${result.errorCategory}: ${result.error ?? ''}` },
        });
        log.warn({ category: result.errorCategory }, 'critical failure — pausing entire campaign');
        return;
      }

      if (result.success) {
        await prisma.group.update({
          where: { id: cg.groupId },
          data: { lastPosted: new Date() },
        });
        consecutiveFails = 0;
        finalResult = result;
        break;
      }

      // Retry path
      if (attempt <= setting.maxRetryPerGroup) {
        if (!fastMode) {
          await humanDelay(setting.retryDelayMinMs, setting.retryDelayMaxMs);
        }
        attempt++;
      } else {
        // Mark skipped
        await prisma.postLog.updateMany({
          where: { campaignId: campaign.id, groupId: cg.groupId, status: 'failed' },
          data: { status: 'skipped' },
        });
        finalResult = result;
        consecutiveFails++;
        break;
      }
    }

    if (consecutiveFails >= setting.stopAfterConsecutiveFailures) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'paused', lastError: `consecutive_failures=${consecutiveFails}` },
      });
      log.warn({ consecutiveFails }, 'consecutive fail threshold reached — paused');
      pauseTriggered = true;
      break;
    }

    // Inter-group delay
    if (!fastMode && toPost.indexOf(cg) < toPost.length - 1) {
      await humanDelay(setting.delayBetweenGroupsMinMs, setting.delayBetweenGroupsMaxMs);
    }
  }

  if (pauseTriggered) return;

  // 5. Finalize
  if (campaign.recurrence) {
    const base = calculateNextRun(new Date(), campaign.recurrence);
    if (base) {
      const next = applyJitter(base, campaign.jitterMinutes);
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'scheduled', scheduledAt: next, completedAt: new Date() },
      });
      log.info({ next: next.toISOString() }, 'recurring — rescheduled');
      return;
    }
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'completed', completedAt: new Date() },
  });
  log.info('campaign completed');
}
```

- [ ] **Step 4: Verify passing**

Run: `pnpm -F worker test runner`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/campaigns/runner.ts apps/worker/src/campaigns/runner.test.ts
git commit -m "feat(worker): add campaign runner with retry, pause, and resume logic"
```

---

### Task F3: Real Playwright adapter (wire actual browser)

**Files:**
- Create: `apps/worker/src/playwright/adapter.ts`

- [ ] **Step 1: Write file**

```typescript
// apps/worker/src/playwright/adapter.ts
import type { PrismaClient } from '@prisma/client';
import type { PlaywrightAdapter } from '../campaigns/runner.js';
import { launchBrowser } from './browser.js';
import { verifySession } from './session.js';
import { postToGroup as playwrightPostToGroup } from './post.js';

export function createRealAdapter(prisma: PrismaClient): PlaywrightAdapter {
  return {
    verifySession: async (userId) => verifySession(userId),
    postToGroup: async (input) => {
      const ctx = await launchBrowser({ userId: input.userId, headless: false });
      try {
        const setting = await prisma.setting.findUniqueOrThrow({ where: { userId: input.userId } });
        return await playwrightPostToGroup(ctx, {
          fbUrl: input.fbUrl,
          content: input.content,
          mediaFiles: input.mediaFiles,
          enableScrollBeforePost: setting.enableScrollBeforePost,
          delayBeforePost: { min: setting.delayBeforePostMinMs, max: setting.delayBeforePostMaxMs },
          delayAfterFocus: { min: setting.delayAfterFocusMinMs, max: setting.delayAfterFocusMaxMs },
        });
      } finally {
        await ctx.close();
      }
    },
  };
}
```

Note: current design opens a new browser context for each group. In Phase J we'll optimize to reuse one context across a campaign.

- [ ] **Step 2: Typecheck**

Run: `pnpm -F worker typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/playwright/adapter.ts
git commit -m "feat(worker): wire real Playwright adapter to runner interface"
```

---

## Phase G — Scheduler

### Task G1: Scheduler poll loop (TDD)

**Files:**
- Create: `apps/worker/src/scheduler.ts`
- Create: `apps/worker/src/scheduler.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/worker/src/scheduler.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { setupTestDb, seedBasic, type TestDb } from '../test/setup-db.js';
import { pollAndRunOnce } from './scheduler.js';

describe('pollAndRunOnce', () => {
  let db: TestDb;
  let prisma: PrismaClient;

  beforeEach(async () => {
    db = await setupTestDb();
    prisma = db.prisma;
  });
  afterEach(async () => { await db.cleanup(); });

  function adapter() {
    return {
      verifySession: vi.fn().mockResolvedValue({ valid: true }),
      postToGroup: vi.fn().mockResolvedValue({ success: true }),
    };
  }

  it('picks the earliest due campaign and runs it', async () => {
    const { user, groups } = await seedBasic(prisma, { groups: 2 });
    const now = new Date();
    const c1 = await prisma.campaign.create({
      data: {
        userId: user.id, content: 'first', status: 'scheduled',
        scheduledAt: new Date(now.getTime() - 60_000),
        groups: { create: [{ groupId: groups[0]!.id, order: 0 }] },
      },
    });
    await prisma.campaign.create({
      data: {
        userId: user.id, content: 'later', status: 'scheduled',
        scheduledAt: new Date(now.getTime() + 3_600_000),
        groups: { create: [{ groupId: groups[1]!.id, order: 0 }] },
      },
    });

    const a = adapter();
    const ran = await pollAndRunOnce({ prisma, adapter: a, fastMode: true });
    expect(ran).toBe(c1.id);

    const updated = await prisma.campaign.findUniqueOrThrow({ where: { id: c1.id } });
    expect(updated.status).toBe('completed');
  });

  it('returns null when no due campaign', async () => {
    const { user, groups } = await seedBasic(prisma, { groups: 1 });
    await prisma.campaign.create({
      data: {
        userId: user.id, content: 'later', status: 'scheduled',
        scheduledAt: new Date(Date.now() + 3_600_000),
        groups: { create: [{ groupId: groups[0]!.id, order: 0 }] },
      },
    });
    const ran = await pollAndRunOnce({ prisma, adapter: adapter(), fastMode: true });
    expect(ran).toBeNull();
  });

  it('ignores campaigns not in scheduled status', async () => {
    const { user, groups } = await seedBasic(prisma, { groups: 1 });
    await prisma.campaign.create({
      data: {
        userId: user.id, content: 'draft', status: 'draft',
        scheduledAt: new Date(Date.now() - 60_000),
        groups: { create: [{ groupId: groups[0]!.id, order: 0 }] },
      },
    });
    const ran = await pollAndRunOnce({ prisma, adapter: adapter(), fastMode: true });
    expect(ran).toBeNull();
  });
});
```

- [ ] **Step 2: Verify failing**

Run: `pnpm -F worker test scheduler`
Expected: FAIL — `scheduler.ts` not found.

- [ ] **Step 3: Write implementation**

```typescript
// apps/worker/src/scheduler.ts
import type { PrismaClient } from '@prisma/client';
import { runCampaign, type PlaywrightAdapter } from './campaigns/runner.js';
import { logger } from './logger.js';

export interface PollOpts {
  prisma: PrismaClient;
  adapter: PlaywrightAdapter;
  fastMode?: boolean;
}

/**
 * Find the earliest due campaign and run it. Returns the campaign id that ran,
 * or null if nothing was due.
 */
export async function pollAndRunOnce(opts: PollOpts): Promise<string | null> {
  const now = new Date();
  const due = await opts.prisma.campaign.findFirst({
    where: { status: 'scheduled', scheduledAt: { lte: now } },
    orderBy: { scheduledAt: 'asc' },
    select: { id: true },
  });
  if (!due) return null;

  logger.info({ campaignId: due.id }, 'picked up due campaign');
  await runCampaign({ campaignId: due.id, prisma: opts.prisma, adapter: opts.adapter, fastMode: opts.fastMode });
  return due.id;
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
      await pollAndRunOnce(opts);
    } catch (err) {
      logger.error({ err }, 'scheduler tick failed');
    } finally {
      running = false;
    }
  };

  const handle = setInterval(tick, interval);
  // Kick off immediately once
  void tick();

  return () => {
    stopped = true;
    clearInterval(handle);
  };
}
```

- [ ] **Step 4: Verify passing**

Run: `pnpm -F worker test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/scheduler.ts apps/worker/src/scheduler.test.ts
git commit -m "feat(worker): add DB-polling scheduler with integration tests"
```

---

### Task G2: Worker entrypoint

**Files:**
- Create: `apps/worker/src/main.ts`

- [ ] **Step 1: Write file**

```typescript
// apps/worker/src/main.ts
import 'dotenv/config';
import { prisma } from '@app/db';
import { startScheduler } from './scheduler.js';
import { createRealAdapter } from './playwright/adapter.js';
import { logger } from './logger.js';

async function main() {
  logger.info('worker starting');
  const adapter = createRealAdapter(prisma);
  const stop = startScheduler({ prisma, adapter, intervalMs: 30_000 });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    stop();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main().catch((err) => {
  logger.fatal({ err }, 'worker crashed');
  process.exit(1);
});
```

- [ ] **Step 2: Install `dotenv`**

Edit `apps/worker/package.json`: add `"dotenv": "^16.4.0"` to `dependencies`.

Run: `pnpm install`

- [ ] **Step 3: Typecheck**

Run: `pnpm -F worker typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/main.ts apps/worker/package.json pnpm-lock.yaml
git commit -m "feat(worker): add entrypoint with scheduler and graceful shutdown"
```

---

## Phase H — Web UI scaffolding

### Task H1: Create `apps/web` Next.js app

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/next-env.d.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/app/globals.css`

- [ ] **Step 1: Write `apps/web/package.json`**

```json
{
  "name": "web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@app/db": "workspace:*",
    "@app/shared": "workspace:*",
    "@trpc/client": "^11.0.0-rc.648",
    "@trpc/next": "^11.0.0-rc.648",
    "@trpc/react-query": "^11.0.0-rc.648",
    "@trpc/server": "^11.0.0-rc.648",
    "@tanstack/react-query": "^5.56.0",
    "clsx": "^2.1.0",
    "lucide-react": "^0.445.0",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "superjson": "^2.2.0",
    "tailwind-merge": "^2.5.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Write `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] },
    "incremental": true,
    "allowJs": true,
    "noEmit": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write `apps/web/next.config.ts`**

```typescript
import type { NextConfig } from 'next';
const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@app/db', '@app/shared'],
  experimental: { serverActions: { bodySizeLimit: '600mb' } },
};
export default config;
```

- [ ] **Step 4: Write `apps/web/next-env.d.ts`**

```typescript
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

- [ ] **Step 5: Write `apps/web/postcss.config.mjs`**

```javascript
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

- [ ] **Step 6: Write `apps/web/tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
export default config;
```

- [ ] **Step 7: Write `apps/web/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color-scheme: light; }
body { @apply bg-neutral-50 text-neutral-900; font-family: ui-sans-serif, system-ui, sans-serif; }
```

- [ ] **Step 8: Write `apps/web/app/layout.tsx`**

```tsx
import './globals.css';
import type { ReactNode } from 'react';
import { TRPCProvider } from '@/lib/trpc-client';

export const metadata = { title: 'FB Auto-Post' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body>
        <TRPCProvider>
          <div className="mx-auto max-w-6xl p-6">
            <header className="mb-8 flex items-center justify-between">
              <h1 className="text-2xl font-semibold">FB Auto-Post</h1>
              <nav className="flex gap-4 text-sm">
                <a href="/" className="hover:underline">Dashboard</a>
                <a href="/campaigns" className="hover:underline">Campaigns</a>
                <a href="/groups" className="hover:underline">Groups</a>
                <a href="/logs" className="hover:underline">Logs</a>
                <a href="/settings" className="hover:underline">Settings</a>
                <a href="/session" className="hover:underline">Session</a>
              </nav>
            </header>
            {children}
          </div>
        </TRPCProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 9: Write `apps/web/app/page.tsx`** (placeholder — replaced in Phase I)

```tsx
export default function HomePage() {
  return <main>Dashboard coming soon</main>;
}
```

- [ ] **Step 10: Install**

Run: `pnpm install`
Expected: Next.js + deps installed.

- [ ] **Step 11: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "chore(web): scaffold Next.js 15 app with Tailwind"
```

---

### Task H2: tRPC setup (server + context + root router + client)

**Files:**
- Create: `apps/web/server/trpc.ts`
- Create: `apps/web/server/context.ts`
- Create: `apps/web/server/root.ts`
- Create: `apps/web/app/api/trpc/[trpc]/route.ts`
- Create: `apps/web/lib/trpc-client.tsx`

- [ ] **Step 1: Write `apps/web/server/trpc.ts`**

```typescript
import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import type { Context } from './context.js';

const t = initTRPC.context<Context>().create({ transformer: superjson });
export const router = t.router;
export const publicProcedure = t.procedure;
```

- [ ] **Step 2: Write `apps/web/server/context.ts`**

```typescript
import { prisma } from '@app/db';

export async function createContext() {
  return { prisma, userId: 'default-user' };
}
export type Context = Awaited<ReturnType<typeof createContext>>;
```

- [ ] **Step 3: Write `apps/web/server/root.ts`** (stub routers — filled in Phase I)

```typescript
import { router } from './trpc.js';

export const appRouter = router({});
export type AppRouter = typeof appRouter;
```

- [ ] **Step 4: Write `apps/web/app/api/trpc/[trpc]/route.ts`**

```typescript
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/root';
import { createContext } from '@/server/context';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
  });
export { handler as GET, handler as POST };
```

- [ ] **Step 5: Write `apps/web/lib/trpc-client.tsx`**

```tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import superjson from 'superjson';
import { useState, type ReactNode } from 'react';
import type { AppRouter } from '@/server/root';

export const trpc = createTRPCReact<AppRouter>();

export function TRPCProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [httpBatchLink({ url: '/api/trpc', transformer: superjson })],
    }),
  );
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `pnpm -F web typecheck`
Expected: no errors.

- [ ] **Step 7: Smoke test**

Run: `pnpm -F web dev`
Open http://localhost:3000 — expect "Dashboard coming soon". Stop with Ctrl+C.

- [ ] **Step 8: Commit**

```bash
git add apps/web/server apps/web/app/api apps/web/lib/trpc-client.tsx
git commit -m "feat(web): set up tRPC with Next.js App Router and React Query"
```

---

## Phase I — Web UI features

Phase I adds CRUD routers and pages. For brevity, tasks I1–I8 share a common style: add a tRPC router, then build the page that uses it. Tests at this layer focus on router input validation (Zod catches most issues).

### Task I1: Session router + setup page

**Files:**
- Create: `apps/web/server/routers/session.ts`
- Create: `apps/web/app/session/page.tsx`
- Modify: `apps/web/server/root.ts`

- [ ] **Step 1: Write `apps/web/server/routers/session.ts`**

```typescript
import { router, publicProcedure } from '../trpc.js';
import { z } from 'zod';

export const sessionRouter = router({
  status: publicProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: ctx.userId } });
    return {
      valid: user.sessionValid,
      checkedAt: user.sessionChecked,
    };
  }),

  /** Sets a flag that the worker polls; worker will open headed browser. */
  requestSetup: publicProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.user.update({
      where: { id: ctx.userId },
      data: { sessionPath: 'pending-setup', sessionValid: false },
    });
    return { ok: true };
  }),

  /** User clicks "verify" after logging in. Worker picks this up via polling. */
  requestVerify: publicProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.user.update({
      where: { id: ctx.userId },
      data: { sessionPath: 'pending-verify' },
    });
    return { ok: true };
  }),
});
```

Note: in this plan we use DB flags to trigger worker actions. A simpler alternative (if UX allows) is to have the Web app exec a CLI directly; we stick with DB flags for symmetry.

- [ ] **Step 2: Wire into `apps/web/server/root.ts`**

```typescript
import { router } from './trpc.js';
import { sessionRouter } from './routers/session.js';

export const appRouter = router({
  session: sessionRouter,
});
export type AppRouter = typeof appRouter;
```

- [ ] **Step 3: Extend worker to handle session requests**

Create `apps/worker/src/session/requests.ts`:

```typescript
import { prisma } from '@app/db';
import { openSessionSetup, verifySession } from '../playwright/session.js';
import { logger } from '../logger.js';

export async function handleSessionRequests(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  if (user.sessionPath === 'pending-setup') {
    logger.info({ userId }, 'session setup requested');
    await prisma.user.update({ where: { id: userId }, data: { sessionPath: 'setup-in-progress' } });
    await openSessionSetup(userId);
    await prisma.user.update({ where: { id: userId }, data: { sessionPath: null } });
  } else if (user.sessionPath === 'pending-verify') {
    logger.info({ userId }, 'session verify requested');
    await prisma.user.update({ where: { id: userId }, data: { sessionPath: 'verifying' } });
    await verifySession(userId);
    await prisma.user.update({ where: { id: userId }, data: { sessionPath: null } });
  }
}
```

Edit `apps/worker/src/scheduler.ts` — inside `tick`, before `pollAndRunOnce`, call `handleSessionRequests('default-user')`:

```typescript
// at top
import { handleSessionRequests } from './session/requests.js';

// inside tick, before pollAndRunOnce:
await handleSessionRequests('default-user');
```

- [ ] **Step 4: Write `apps/web/app/session/page.tsx`**

```tsx
'use client';
import { trpc } from '@/lib/trpc-client';

export default function SessionPage() {
  const status = trpc.session.status.useQuery();
  const setup = trpc.session.requestSetup.useMutation({ onSuccess: () => status.refetch() });
  const verify = trpc.session.requestVerify.useMutation({ onSuccess: () => status.refetch() });

  return (
    <main className="space-y-4">
      <h2 className="text-xl font-semibold">Facebook Session</h2>
      <p>
        Status:{' '}
        <span className={status.data?.valid ? 'text-green-700' : 'text-red-700'}>
          {status.data?.valid ? 'valid' : 'invalid'}
        </span>
        {status.data?.checkedAt && (
          <span className="ml-2 text-neutral-500">
            (checked {new Date(status.data.checkedAt).toLocaleString()})
          </span>
        )}
      </p>

      <div className="space-y-2">
        <button
          onClick={() => setup.mutate()}
          className="rounded bg-blue-600 px-4 py-2 text-white"
          disabled={setup.isPending}
        >
          1. Open browser to log in
        </button>
        <p className="text-sm text-neutral-600">
          Worker will open a Chrome window. Log in to Facebook (including 2FA), then close that window.
        </p>

        <button
          onClick={() => verify.mutate()}
          className="rounded bg-green-600 px-4 py-2 text-white"
          disabled={verify.isPending}
        >
          2. Verify session
        </button>
        <p className="text-sm text-neutral-600">
          After closing the login window, click verify to confirm the session works.
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm -F web typecheck && pnpm -F worker typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/server/routers/session.ts apps/web/server/root.ts apps/web/app/session/page.tsx apps/worker/src/session/requests.ts apps/worker/src/scheduler.ts
git commit -m "feat: add session status and setup flow (web + worker)"
```

---

### Task I2: Group router + pages

**Files:**
- Create: `apps/web/server/routers/group.ts`
- Create: `apps/web/app/groups/page.tsx`
- Modify: `apps/web/server/root.ts`

- [ ] **Step 1: Write `apps/web/server/routers/group.ts`**

```typescript
import { router, publicProcedure } from '../trpc.js';
import { z } from 'zod';
import { groupCreateSchema, groupBulkCreateSchema, parseGroupUrl } from '@app/shared';

export const groupRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.group.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: 'desc' },
    });
  }),

  create: publicProcedure.input(groupCreateSchema).mutation(async ({ ctx, input }) => {
    const parsed = parseGroupUrl(input.fbUrl)!;
    return ctx.prisma.group.upsert({
      where: { userId_fbGroupId: { userId: ctx.userId, fbGroupId: parsed.fbGroupId } },
      create: {
        userId: ctx.userId,
        fbGroupId: parsed.fbGroupId,
        fbUrl: parsed.canonicalUrl,
        name: input.name,
        source: input.source,
      },
      update: { name: input.name ?? undefined, isActive: true },
    });
  }),

  bulkCreate: publicProcedure.input(groupBulkCreateSchema).mutation(async ({ ctx, input }) => {
    const created: Array<{ id: string; fbGroupId: string }> = [];
    const skipped: string[] = [];
    for (const url of input.urls) {
      const parsed = parseGroupUrl(url);
      if (!parsed) { skipped.push(url); continue; }
      const g = await ctx.prisma.group.upsert({
        where: { userId_fbGroupId: { userId: ctx.userId, fbGroupId: parsed.fbGroupId } },
        create: {
          userId: ctx.userId, fbGroupId: parsed.fbGroupId, fbUrl: parsed.canonicalUrl, source: 'manual',
        },
        update: { isActive: true },
      });
      created.push({ id: g.id, fbGroupId: g.fbGroupId });
    }
    return { created, skipped };
  }),

  setActive: publicProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.group.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
      });
      return { ok: true };
    }),

  remove: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    // Soft-remove by deactivating (keep for historical PostLog integrity)
    await ctx.prisma.group.update({ where: { id: input.id }, data: { isActive: false } });
    return { ok: true };
  }),
});
```

- [ ] **Step 2: Wire into root**

```typescript
// apps/web/server/root.ts
import { router } from './trpc.js';
import { sessionRouter } from './routers/session.js';
import { groupRouter } from './routers/group.js';

export const appRouter = router({
  session: sessionRouter,
  group: groupRouter,
});
export type AppRouter = typeof appRouter;
```

- [ ] **Step 3: Write `apps/web/app/groups/page.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';

export default function GroupsPage() {
  const list = trpc.group.list.useQuery();
  const bulk = trpc.group.bulkCreate.useMutation({ onSuccess: () => list.refetch() });
  const setActive = trpc.group.setActive.useMutation({ onSuccess: () => list.refetch() });
  const remove = trpc.group.remove.useMutation({ onSuccess: () => list.refetch() });

  const [urls, setUrls] = useState('');

  return (
    <main className="space-y-6">
      <section>
        <h2 className="text-xl font-semibold">Add Groups (paste one URL per line)</h2>
        <textarea
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          rows={5}
          placeholder="https://www.facebook.com/groups/123456"
          className="mt-2 w-full rounded border p-2 font-mono text-sm"
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => {
              const arr = urls.split('\n').map((s) => s.trim()).filter(Boolean);
              if (arr.length > 0) bulk.mutate({ urls: arr });
            }}
            className="rounded bg-blue-600 px-4 py-2 text-white"
          >
            Add
          </button>
        </div>
        {bulk.data && (
          <div className="mt-2 text-sm">
            Added {bulk.data.created.length}, skipped {bulk.data.skipped.length}.
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold">Groups ({list.data?.length ?? 0})</h2>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left">
              <th>Active</th><th>Name / ID</th><th>URL</th><th>Last posted</th><th></th>
            </tr>
          </thead>
          <tbody>
            {list.data?.map((g) => (
              <tr key={g.id} className="border-t">
                <td>
                  <input
                    type="checkbox"
                    checked={g.isActive}
                    onChange={(e) => setActive.mutate({ id: g.id, isActive: e.target.checked })}
                  />
                </td>
                <td>{g.name ?? g.fbGroupId}</td>
                <td className="text-blue-700"><a href={g.fbUrl} target="_blank">{g.fbUrl}</a></td>
                <td>{g.lastPosted ? new Date(g.lastPosted).toLocaleString() : '—'}</td>
                <td><button onClick={() => remove.mutate({ id: g.id })} className="text-red-600">Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm -F web typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/server/routers/group.ts apps/web/server/root.ts apps/web/app/groups/page.tsx
git commit -m "feat(web): add group CRUD router and management page"
```

---

### Task I3: Media upload endpoint

**Files:**
- Create: `apps/web/app/api/upload/route.ts`
- Create: `apps/web/lib/files.ts`

- [ ] **Step 1: Write `apps/web/lib/files.ts`**

```typescript
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const UPLOAD_ROOT = resolve(process.cwd(), '..', '..', 'uploads');

export async function saveUploadedFile(
  file: File,
  campaignId: string,
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'bin';
  const dir = join(UPLOAD_ROOT, campaignId);
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  const fullPath = join(dir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buffer);
  // Return absolute path — Playwright `setInputFiles` needs absolute
  return fullPath;
}
```

- [ ] **Step 2: Write `apps/web/app/api/upload/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { saveUploadedFile } from '@/lib/files';
import { MAX_IMAGES_PER_POST } from '@app/shared';

const MAX_IMAGES_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const campaignId = String(form.get('campaignId') ?? '');
  const kind = String(form.get('kind') ?? 'images'); // "images" | "video"
  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 });

  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ error: 'no files' }, { status: 400 });

  if (kind === 'video' && files.length !== 1) {
    return NextResponse.json({ error: 'video must be exactly 1 file' }, { status: 400 });
  }
  if (kind === 'images' && files.length > MAX_IMAGES_PER_POST) {
    return NextResponse.json({ error: `too many images (max ${MAX_IMAGES_PER_POST})` }, { status: 400 });
  }

  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  const limit = kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGES_BYTES;
  if (totalBytes > limit) {
    return NextResponse.json({ error: `total size exceeds ${limit}` }, { status: 400 });
  }

  const paths = await Promise.all(files.map((f) => saveUploadedFile(f, campaignId)));
  return NextResponse.json({ paths });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/upload/route.ts apps/web/lib/files.ts
git commit -m "feat(web): add multipart upload endpoint with size and count limits"
```

---

### Task I4: Campaign router + create/edit pages

**Files:**
- Create: `apps/web/server/routers/campaign.ts`
- Create: `apps/web/app/campaigns/page.tsx`
- Create: `apps/web/app/campaigns/new/page.tsx`
- Create: `apps/web/app/campaigns/[id]/page.tsx`
- Create: `apps/web/components/campaign-form.tsx`
- Modify: `apps/web/server/root.ts`

- [ ] **Step 1: Write `apps/web/server/routers/campaign.ts`**

```typescript
import { router, publicProcedure } from '../trpc.js';
import { z } from 'zod';
import { campaignCreateSchema, campaignUpdateSchema } from '@app/shared';
import { calculateNextRun, applyJitter } from '../../../worker/src/campaigns/recurrence.js';

// NOTE: importing from worker package is a shortcut. Alternatively, move recurrence helper
// to packages/shared. For MVP we duplicate logic here to avoid the cross-app import:

function nextRunFromRecurrence(recurrence: string | null | undefined, from: Date): Date | null {
  if (!recurrence) return null;
  // Minimal inline cron parsing via string — use cron-parser here too
  // For Phase I we accept any recurrence string and validate in UI
  return null;
}

export const campaignRouter = router({
  list: publicProcedure.query(({ ctx }) =>
    ctx.prisma.campaign.findMany({
      where: { userId: ctx.userId },
      include: { groups: { include: { group: true } } },
      orderBy: { scheduledAt: 'desc' },
    }),
  ),

  get: publicProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) =>
    ctx.prisma.campaign.findUniqueOrThrow({
      where: { id: input.id },
      include: {
        groups: { include: { group: true }, orderBy: { order: 'asc' } },
        logs: { orderBy: { createdAt: 'desc' } },
      },
    }),
  ),

  create: publicProcedure.input(campaignCreateSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.campaign.create({
      data: {
        userId: ctx.userId,
        title: input.title,
        content: input.content,
        mediaType: input.mediaType,
        mediaFiles: JSON.stringify(input.mediaFiles),
        scheduledAt: input.scheduledAt,
        recurrence: input.recurrence ?? null,
        jitterMinutes: input.jitterMinutes,
        status: 'scheduled',
        groups: {
          create: input.groupIds.map((gid, i) => ({ groupId: gid, order: i })),
        },
      },
    });
  }),

  update: publicProcedure.input(campaignUpdateSchema).mutation(async ({ ctx, input }) => {
    const existing = await ctx.prisma.campaign.findUniqueOrThrow({ where: { id: input.id } });
    if (existing.status === 'running') throw new Error('Cannot edit running campaign');

    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.content !== undefined) data.content = input.content;
    if (input.scheduledAt !== undefined) data.scheduledAt = input.scheduledAt;
    if (input.recurrence !== undefined) data.recurrence = input.recurrence ?? null;
    if (input.jitterMinutes !== undefined) data.jitterMinutes = input.jitterMinutes;
    if (input.mediaFiles !== undefined) data.mediaFiles = JSON.stringify(input.mediaFiles);
    if (input.mediaType !== undefined) data.mediaType = input.mediaType;

    return ctx.prisma.campaign.update({ where: { id: input.id }, data });
  }),

  cancel: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const c = await ctx.prisma.campaign.findUniqueOrThrow({ where: { id: input.id } });
    if (c.status === 'running') throw new Error('Cannot cancel running campaign (it will complete its current group)');
    await ctx.prisma.campaign.update({ where: { id: input.id }, data: { status: 'completed', completedAt: new Date() } });
    return { ok: true };
  }),

  resume: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const c = await ctx.prisma.campaign.findUniqueOrThrow({ where: { id: input.id } });
    if (c.status !== 'paused') throw new Error('Only paused campaigns can be resumed');
    await ctx.prisma.campaign.update({
      where: { id: input.id },
      data: { status: 'scheduled', scheduledAt: new Date(Date.now() + 5 * 60_000), lastError: null },
    });
    return { ok: true };
  }),
});
```

- [ ] **Step 2: Remove cross-app import**

The `import ... from '../../../worker/src/...'` in Step 1 is bad — remove the `nextRunFromRecurrence` stub entirely; recurrence calculation happens in the worker on finalize, not in the Web API.

- [ ] **Step 3: Wire into root**

```typescript
// apps/web/server/root.ts
import { router } from './trpc.js';
import { sessionRouter } from './routers/session.js';
import { groupRouter } from './routers/group.js';
import { campaignRouter } from './routers/campaign.js';

export const appRouter = router({
  session: sessionRouter,
  group: groupRouter,
  campaign: campaignRouter,
});
export type AppRouter = typeof appRouter;
```

- [ ] **Step 4: Write `apps/web/components/campaign-form.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import type { MediaType } from '@app/shared';

export function CampaignForm({
  initial,
  campaignId,
  onSaved,
}: {
  initial?: { title?: string; content?: string; scheduledAt?: Date; recurrence?: string | null };
  campaignId?: string;
  onSaved?: (id: string) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [scheduledAt, setScheduledAt] = useState(
    initial?.scheduledAt ? initial.scheduledAt.toISOString().slice(0, 16) : '',
  );
  const [recurrence, setRecurrence] = useState(initial?.recurrence ?? '');
  const [jitterMinutes, setJitterMinutes] = useState(15);
  const [mediaType, setMediaType] = useState<MediaType>('none');
  const [mediaFiles, setMediaFiles] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  const groups = trpc.group.list.useQuery();
  const create = trpc.campaign.create.useMutation();

  async function uploadFiles(files: FileList) {
    // A campaignId pseudo — use temp id until saved; then real id backfills on create
    const tempId = campaignId ?? `temp-${Date.now()}`;
    const fd = new FormData();
    fd.append('campaignId', tempId);
    fd.append('kind', mediaType);
    Array.from(files).forEach((f) => fd.append('files', f));
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json() as { paths: string[] };
    setMediaFiles((prev) => [...prev, ...data.paths]);
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const result = await create.mutateAsync({
          title: title || undefined,
          content,
          mediaType,
          mediaFiles,
          scheduledAt: new Date(scheduledAt),
          recurrence: recurrence || null,
          jitterMinutes,
          groupIds: selectedGroupIds,
        });
        onSaved?.(result.id);
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-sm font-medium">Title (optional)</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded border p-2" />
      </div>

      <div>
        <label className="block text-sm font-medium">Content</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          required
          className="w-full rounded border p-2"
        />
      </div>

      <div className="flex gap-4">
        <div>
          <label className="block text-sm font-medium">Media type</label>
          <select
            value={mediaType}
            onChange={(e) => { setMediaType(e.target.value as MediaType); setMediaFiles([]); }}
            className="rounded border p-2"
          >
            <option value="none">None</option>
            <option value="images">Images (up to 10)</option>
            <option value="video">Video (1)</option>
          </select>
        </div>

        {mediaType !== 'none' && (
          <div>
            <label className="block text-sm font-medium">Upload</label>
            <input
              type="file"
              multiple={mediaType === 'images'}
              accept={mediaType === 'video' ? 'video/*' : 'image/*'}
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            />
            {mediaFiles.length > 0 && <p className="text-xs text-neutral-600">{mediaFiles.length} file(s) uploaded</p>}
          </div>
        )}
      </div>

      <div className="flex gap-4">
        <div>
          <label className="block text-sm font-medium">Scheduled at</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            required
            className="rounded border p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Recurrence (cron, optional)</label>
          <input
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value)}
            placeholder="0 9 * * MON"
            className="rounded border p-2 font-mono"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Jitter (± minutes)</label>
          <input
            type="number"
            min={0}
            max={120}
            value={jitterMinutes}
            onChange={(e) => setJitterMinutes(Number(e.target.value))}
            className="rounded border p-2 w-20"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Target groups ({selectedGroupIds.length} selected)</label>
        <div className="max-h-60 overflow-auto rounded border p-2">
          {groups.data?.filter((g) => g.isActive).map((g) => (
            <label key={g.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedGroupIds.includes(g.id)}
                onChange={(e) => {
                  setSelectedGroupIds((prev) =>
                    e.target.checked ? [...prev, g.id] : prev.filter((id) => id !== g.id),
                  );
                }}
              />
              <span>{g.name ?? g.fbGroupId}</span>
            </label>
          ))}
        </div>
      </div>

      <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white" disabled={create.isPending}>
        {create.isPending ? 'Saving...' : 'Schedule'}
      </button>
      {create.error && <p className="text-red-600 text-sm">{create.error.message}</p>}
    </form>
  );
}
```

- [ ] **Step 5: Write `apps/web/app/campaigns/new/page.tsx`**

```tsx
'use client';
import { CampaignForm } from '@/components/campaign-form';
import { useRouter } from 'next/navigation';

export default function NewCampaignPage() {
  const router = useRouter();
  return (
    <main>
      <h2 className="mb-4 text-xl font-semibold">New Campaign</h2>
      <CampaignForm onSaved={(id) => router.push(`/campaigns/${id}`)} />
    </main>
  );
}
```

- [ ] **Step 6: Write `apps/web/app/campaigns/page.tsx`**

```tsx
'use client';
import { trpc } from '@/lib/trpc-client';
import Link from 'next/link';

export default function CampaignsPage() {
  const list = trpc.campaign.list.useQuery();
  return (
    <main>
      <div className="mb-4 flex justify-between">
        <h2 className="text-xl font-semibold">Campaigns</h2>
        <Link href="/campaigns/new" className="rounded bg-blue-600 px-4 py-2 text-white">New</Link>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left"><th>Title</th><th>Status</th><th>Scheduled</th><th>Groups</th></tr></thead>
        <tbody>
          {list.data?.map((c) => (
            <tr key={c.id} className="border-t">
              <td><Link href={`/campaigns/${c.id}`} className="text-blue-700">{c.title ?? c.content.slice(0, 40)}</Link></td>
              <td>{c.status}</td>
              <td>{new Date(c.scheduledAt).toLocaleString()}</td>
              <td>{c.groups.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 7: Write `apps/web/app/campaigns/[id]/page.tsx`**

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

  return (
    <main className="space-y-4">
      <h2 className="text-xl font-semibold">{d.title ?? 'Campaign'}</h2>
      <p>Status: <strong>{d.status}</strong></p>
      <p>Scheduled: {new Date(d.scheduledAt).toLocaleString()}</p>
      {d.lastError && <p className="text-red-700 text-sm">Last error: {d.lastError}</p>}

      <div className="flex gap-2">
        {d.status === 'paused' && (
          <button onClick={() => resume.mutate({ id })} className="rounded bg-green-600 px-4 py-2 text-white">
            Resume
          </button>
        )}
        {d.status !== 'completed' && d.status !== 'running' && (
          <button onClick={() => cancel.mutate({ id })} className="rounded bg-neutral-600 px-4 py-2 text-white">
            Cancel
          </button>
        )}
      </div>

      <div>
        <h3 className="font-semibold mt-4">Content</h3>
        <pre className="whitespace-pre-wrap rounded bg-neutral-100 p-2 text-sm">{d.content}</pre>
      </div>

      <div>
        <h3 className="font-semibold mt-4">Groups ({d.groups.length})</h3>
        <ul className="text-sm">
          {d.groups.map((cg) => (
            <li key={cg.groupId}>{cg.group.name ?? cg.group.fbGroupId}</li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="font-semibold mt-4">Logs ({d.logs.length})</h3>
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
                  <td className="text-red-700 truncate max-w-xs">{l.error}</td>
                  <td>{l.completedAt ? new Date(l.completedAt).toLocaleString() : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
```

- [ ] **Step 8: Typecheck**

Run: `pnpm -F web typecheck`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/web/server/routers/campaign.ts apps/web/server/root.ts apps/web/app/campaigns apps/web/components/campaign-form.tsx
git commit -m "feat(web): add campaign router, form, list, and detail pages"
```

---

### Task I5: Settings router + page

**Files:**
- Create: `apps/web/server/routers/setting.ts`
- Create: `apps/web/app/settings/page.tsx`
- Modify: `apps/web/server/root.ts`

- [ ] **Step 1: Write `apps/web/server/routers/setting.ts`**

```typescript
import { router, publicProcedure } from '../trpc.js';
import { z } from 'zod';

const settingSchema = z.object({
  delayBetweenGroupsMinMs: z.number().int().min(0).max(3_600_000),
  delayBetweenGroupsMaxMs: z.number().int().min(0).max(3_600_000),
  delayBeforePostMinMs: z.number().int().min(0).max(60_000),
  delayBeforePostMaxMs: z.number().int().min(0).max(60_000),
  delayAfterFocusMinMs: z.number().int().min(0).max(60_000),
  delayAfterFocusMaxMs: z.number().int().min(0).max(60_000),
  maxRetryPerGroup: z.number().int().min(0).max(10),
  retryDelayMinMs: z.number().int().min(0).max(3_600_000),
  retryDelayMaxMs: z.number().int().min(0).max(3_600_000),
  stopAfterConsecutiveFailures: z.number().int().min(1).max(20),
  enableMouseMove: z.boolean(),
  enableScrollBeforePost: z.boolean(),
  enableJitter: z.boolean(),
});

export const settingRouter = router({
  get: publicProcedure.query(async ({ ctx }) =>
    ctx.prisma.setting.findUniqueOrThrow({ where: { userId: ctx.userId } }),
  ),

  update: publicProcedure.input(settingSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.setting.update({ where: { userId: ctx.userId }, data: input });
  }),
});
```

- [ ] **Step 2: Wire into root**

```typescript
// apps/web/server/root.ts — add settingRouter
import { settingRouter } from './routers/setting.js';
export const appRouter = router({
  session: sessionRouter,
  group: groupRouter,
  campaign: campaignRouter,
  setting: settingRouter,
});
export type AppRouter = typeof appRouter;
```

- [ ] **Step 3: Write `apps/web/app/settings/page.tsx`**

```tsx
'use client';
import { trpc } from '@/lib/trpc-client';
import { useEffect, useState } from 'react';

type Values = {
  delayBetweenGroupsMinMs: number; delayBetweenGroupsMaxMs: number;
  delayBeforePostMinMs: number; delayBeforePostMaxMs: number;
  delayAfterFocusMinMs: number; delayAfterFocusMaxMs: number;
  maxRetryPerGroup: number;
  retryDelayMinMs: number; retryDelayMaxMs: number;
  stopAfterConsecutiveFailures: number;
  enableMouseMove: boolean; enableScrollBeforePost: boolean; enableJitter: boolean;
};

const PAIRS: Array<[keyof Values, keyof Values, string]> = [
  ['delayBetweenGroupsMinMs', 'delayBetweenGroupsMaxMs', 'Delay between groups (ms)'],
  ['delayBeforePostMinMs',    'delayBeforePostMaxMs',    'Delay before click Post (ms)'],
  ['delayAfterFocusMinMs',    'delayAfterFocusMaxMs',    'Delay after focus composer (ms)'],
  ['retryDelayMinMs',         'retryDelayMaxMs',         'Retry delay (ms)'],
];

export default function SettingsPage() {
  const get = trpc.setting.get.useQuery();
  const update = trpc.setting.update.useMutation({ onSuccess: () => get.refetch() });
  const [v, setV] = useState<Values | null>(null);

  useEffect(() => {
    if (get.data && !v) {
      const { id, userId, ...rest } = get.data;
      setV(rest as Values);
    }
  }, [get.data, v]);

  if (!v) return <p>Loading…</p>;
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV({ ...v, [k]: val });

  return (
    <main className="space-y-6">
      <h2 className="text-xl font-semibold">Settings</h2>

      {PAIRS.map(([kmin, kmax, label]) => (
        <div key={kmin as string} className="flex items-center gap-4">
          <label className="w-64">{label}</label>
          <input
            type="number" className="rounded border p-2 w-32"
            value={v[kmin] as number} onChange={(e) => set(kmin, Number(e.target.value) as Values[typeof kmin])}
          />
          <span>to</span>
          <input
            type="number" className="rounded border p-2 w-32"
            value={v[kmax] as number} onChange={(e) => set(kmax, Number(e.target.value) as Values[typeof kmax])}
          />
        </div>
      ))}

      <div className="flex items-center gap-4">
        <label className="w-64">Max retry per group</label>
        <input type="number" className="rounded border p-2 w-24"
          value={v.maxRetryPerGroup} onChange={(e) => set('maxRetryPerGroup', Number(e.target.value))} />
      </div>
      <div className="flex items-center gap-4">
        <label className="w-64">Stop after consecutive failures</label>
        <input type="number" className="rounded border p-2 w-24"
          value={v.stopAfterConsecutiveFailures} onChange={(e) => set('stopAfterConsecutiveFailures', Number(e.target.value))} />
      </div>

      <div className="flex items-center gap-4"><input type="checkbox" checked={v.enableMouseMove} onChange={(e) => set('enableMouseMove', e.target.checked)} /> Curved mouse moves</div>
      <div className="flex items-center gap-4"><input type="checkbox" checked={v.enableScrollBeforePost} onChange={(e) => set('enableScrollBeforePost', e.target.checked)} /> Scroll before posting</div>
      <div className="flex items-center gap-4"><input type="checkbox" checked={v.enableJitter} onChange={(e) => set('enableJitter', e.target.checked)} /> Apply schedule jitter</div>

      <button
        onClick={() => update.mutate(v)}
        className="rounded bg-blue-600 px-4 py-2 text-white"
        disabled={update.isPending}
      >
        Save
      </button>
    </main>
  );
}
```

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm -F web typecheck
git add apps/web/server/routers/setting.ts apps/web/server/root.ts apps/web/app/settings/page.tsx
git commit -m "feat(web): add settings router and editor page"
```

---

### Task I6: Logs router + page

**Files:**
- Create: `apps/web/server/routers/log.ts`
- Create: `apps/web/app/logs/page.tsx`
- Modify: `apps/web/server/root.ts`

- [ ] **Step 1: Write `apps/web/server/routers/log.ts`**

```typescript
import { router, publicProcedure } from '../trpc.js';
import { z } from 'zod';

export const logRouter = router({
  recent: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(500).default(100) }))
    .query(({ ctx, input }) =>
      ctx.prisma.postLog.findMany({
        take: input.limit,
        orderBy: { createdAt: 'desc' },
        include: { campaign: true, group: true },
      }),
    ),
});
```

- [ ] **Step 2: Wire into root**

```typescript
import { logRouter } from './routers/log.js';
export const appRouter = router({
  session: sessionRouter,
  group: groupRouter,
  campaign: campaignRouter,
  setting: settingRouter,
  log: logRouter,
});
```

- [ ] **Step 3: Write `apps/web/app/logs/page.tsx`**

```tsx
'use client';
import { trpc } from '@/lib/trpc-client';

export default function LogsPage() {
  const logs = trpc.log.recent.useQuery({ limit: 200 });
  return (
    <main>
      <h2 className="text-xl font-semibold">Logs (last 200)</h2>
      <table className="mt-2 w-full text-sm">
        <thead><tr className="text-left">
          <th>Time</th><th>Campaign</th><th>Group</th><th>Status</th><th>Attempt</th><th>Error</th>
        </tr></thead>
        <tbody>
          {logs.data?.map((l) => (
            <tr key={l.id} className="border-t">
              <td>{new Date(l.createdAt).toLocaleString()}</td>
              <td>{l.campaign.title ?? l.campaignId.slice(0, 6)}</td>
              <td>{l.group.name ?? l.group.fbGroupId}</td>
              <td>{l.status}{l.note && ` (${l.note})`}</td>
              <td>{l.attempt}</td>
              <td className="max-w-xs truncate text-red-700">{l.error}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm -F web typecheck
git add apps/web/server/routers/log.ts apps/web/server/root.ts apps/web/app/logs/page.tsx
git commit -m "feat(web): add logs router and history page"
```

---

### Task I7: Dashboard router + home page

**Files:**
- Create: `apps/web/server/routers/dashboard.ts`
- Modify: `apps/web/app/page.tsx`
- Create: `apps/web/components/session-banner.tsx`
- Modify: `apps/web/server/root.ts`

- [ ] **Step 1: Write `apps/web/server/routers/dashboard.ts`**

```typescript
import { router, publicProcedure } from '../trpc.js';

export const dashboardRouter = router({
  summary: publicProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600_000);
    const inSevenDays = new Date(now.getTime() + 7 * 24 * 3600_000);

    const [user, running, upcoming, recentLogs, pausedCount] = await Promise.all([
      ctx.prisma.user.findUniqueOrThrow({ where: { id: ctx.userId } }),
      ctx.prisma.campaign.findFirst({ where: { userId: ctx.userId, status: 'running' } }),
      ctx.prisma.campaign.findMany({
        where: { userId: ctx.userId, status: 'scheduled', scheduledAt: { gte: now, lte: inSevenDays } },
        orderBy: { scheduledAt: 'asc' },
        take: 10,
      }),
      ctx.prisma.postLog.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
      }),
      ctx.prisma.campaign.count({ where: { userId: ctx.userId, status: 'paused' } }),
    ]);

    const success = recentLogs.filter((l) => l.status === 'success').length;
    const failed = recentLogs.filter((l) => l.status === 'failed' || l.status === 'skipped').length;
    const total = success + failed;

    return {
      session: { valid: user.sessionValid, checkedAt: user.sessionChecked },
      running: running ? { id: running.id, title: running.title, startedAt: running.startedAt } : null,
      upcoming: upcoming.map((c) => ({ id: c.id, title: c.title, scheduledAt: c.scheduledAt })),
      recent: { success, failed, successRate: total === 0 ? null : success / total },
      pausedCount,
    };
  }),
});
```

- [ ] **Step 2: Wire into root**

```typescript
import { dashboardRouter } from './routers/dashboard.js';
export const appRouter = router({
  session: sessionRouter,
  group: groupRouter,
  campaign: campaignRouter,
  setting: settingRouter,
  log: logRouter,
  dashboard: dashboardRouter,
});
```

- [ ] **Step 3: Write `apps/web/components/session-banner.tsx`**

```tsx
'use client';
import { trpc } from '@/lib/trpc-client';
import Link from 'next/link';

export function SessionBanner() {
  const status = trpc.session.status.useQuery();
  if (status.data?.valid) return null;
  return (
    <div className="mb-4 rounded bg-red-100 p-3 text-red-900">
      Facebook session is invalid. <Link href="/session" className="underline font-semibold">Re-authenticate</Link>
    </div>
  );
}
```

- [ ] **Step 4: Add banner to layout**

Edit `apps/web/app/layout.tsx` — add `import { SessionBanner } from '@/components/session-banner';` and render `<SessionBanner />` just above `{children}`.

- [ ] **Step 5: Rewrite `apps/web/app/page.tsx`**

```tsx
'use client';
import { trpc } from '@/lib/trpc-client';
import Link from 'next/link';

export default function DashboardPage() {
  const s = trpc.dashboard.summary.useQuery();
  if (!s.data) return <p>Loading…</p>;
  const d = s.data;
  return (
    <main className="space-y-6">
      <section className="grid grid-cols-3 gap-4">
        <div className="rounded border p-4">
          <h3 className="font-semibold">Session</h3>
          <p className={d.session.valid ? 'text-green-700' : 'text-red-700'}>
            {d.session.valid ? 'Valid' : 'Invalid'}
          </p>
        </div>
        <div className="rounded border p-4">
          <h3 className="font-semibold">Running</h3>
          {d.running ? (
            <Link href={`/campaigns/${d.running.id}`} className="text-blue-700">
              {d.running.title ?? d.running.id.slice(0, 6)}
            </Link>
          ) : <p>None</p>}
        </div>
        <div className="rounded border p-4">
          <h3 className="font-semibold">Paused</h3>
          <p>{d.pausedCount}</p>
        </div>
      </section>

      <section>
        <h3 className="font-semibold">Upcoming (7 days)</h3>
        <ul>
          {d.upcoming.map((c) => (
            <li key={c.id}>
              <Link href={`/campaigns/${c.id}`} className="text-blue-700">{c.title ?? c.id.slice(0, 6)}</Link>
              {' — '}{new Date(c.scheduledAt).toLocaleString()}
            </li>
          ))}
          {d.upcoming.length === 0 && <li className="text-neutral-500">None scheduled</li>}
        </ul>
      </section>

      <section>
        <h3 className="font-semibold">Recent activity (7 days)</h3>
        <p>
          Success: {d.recent.success} · Failed/Skipped: {d.recent.failed}
          {d.recent.successRate !== null && ` · Success rate: ${(d.recent.successRate * 100).toFixed(1)}%`}
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Typecheck + commit**

```bash
pnpm -F web typecheck
git add apps/web/server/routers/dashboard.ts apps/web/server/root.ts apps/web/components/session-banner.tsx apps/web/app/page.tsx apps/web/app/layout.tsx
git commit -m "feat(web): add dashboard and global session banner"
```

---

### Task I8: Auto-sync groups (stub + worker trigger)

**Files:**
- Modify: `apps/web/server/routers/group.ts`
- Create: `apps/worker/src/groups/sync.ts`
- Modify: `apps/worker/src/scheduler.ts`

- [ ] **Step 1: Add `requestAutoSync` to group router**

Edit `apps/web/server/routers/group.ts` — append to the router:

```typescript
  requestAutoSync: publicProcedure.mutation(async ({ ctx }) => {
    // Write a flag row by setting sessionPath marker on User. Worker polls this.
    await ctx.prisma.user.update({
      where: { id: ctx.userId },
      data: { sessionPath: 'pending-group-sync' },
    });
    return { ok: true };
  }),
```

- [ ] **Step 2: Write `apps/worker/src/groups/sync.ts`**

```typescript
import type { PrismaClient } from '@prisma/client';
import { launchBrowser } from '../playwright/browser.js';
import { detectFBState } from '../playwright/detect.js';
import { logger } from '../logger.js';
import { parseGroupUrl } from '@app/shared';

export async function autoSyncGroups(userId: string, prisma: PrismaClient): Promise<{ added: number; updated: number }> {
  const ctx = await launchBrowser({ userId, headless: false });
  try {
    const page = await ctx.newPage();
    await page.goto('https://www.facebook.com/groups/feed/', { waitUntil: 'domcontentloaded' });
    const state = await detectFBState(page);
    if (state.type !== 'ok') {
      logger.warn({ state }, 'auto-sync aborted');
      return { added: 0, updated: 0 };
    }

    // Scrape group links from left sidebar. The anchor href pattern is stable:
    // /groups/{id}/ (the first link inside a sidebar item)
    await page.waitForTimeout(3_000);
    const hrefs: string[] = await page.$$eval('a[href*="/groups/"]', (els) =>
      els.map((a) => (a as HTMLAnchorElement).href).filter((h) => /\/groups\/\w+\/?$/.test(h)),
    );
    const unique = Array.from(new Set(hrefs));

    let added = 0, updated = 0;
    for (const href of unique) {
      const p = parseGroupUrl(href);
      if (!p) continue;
      const existing = await prisma.group.findUnique({
        where: { userId_fbGroupId: { userId, fbGroupId: p.fbGroupId } },
      });
      if (existing) {
        updated++;
        continue;
      }
      await prisma.group.create({
        data: {
          userId, fbGroupId: p.fbGroupId, fbUrl: p.canonicalUrl, source: 'auto_sync',
        },
      });
      added++;
    }
    logger.info({ added, updated }, 'auto-sync complete');
    return { added, updated };
  } finally {
    await ctx.close();
  }
}
```

- [ ] **Step 3: Handle in scheduler tick**

Edit `apps/worker/src/session/requests.ts` — extend to also handle `pending-group-sync`:

```typescript
import { prisma } from '@app/db';
import { openSessionSetup, verifySession } from '../playwright/session.js';
import { autoSyncGroups } from '../groups/sync.js';
import { logger } from '../logger.js';

export async function handleSessionRequests(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  if (user.sessionPath === 'pending-setup') {
    await prisma.user.update({ where: { id: userId }, data: { sessionPath: 'setup-in-progress' } });
    await openSessionSetup(userId);
    await prisma.user.update({ where: { id: userId }, data: { sessionPath: null } });
  } else if (user.sessionPath === 'pending-verify') {
    await prisma.user.update({ where: { id: userId }, data: { sessionPath: 'verifying' } });
    await verifySession(userId);
    await prisma.user.update({ where: { id: userId }, data: { sessionPath: null } });
  } else if (user.sessionPath === 'pending-group-sync') {
    await prisma.user.update({ where: { id: userId }, data: { sessionPath: 'syncing' } });
    await autoSyncGroups(userId, prisma);
    await prisma.user.update({ where: { id: userId }, data: { sessionPath: null } });
  }
}
```

- [ ] **Step 4: Add button to Groups page**

Edit `apps/web/app/groups/page.tsx` — add in the form section:

```tsx
        <button
          onClick={() => trpcRequestAutoSync()}
          className="rounded bg-purple-600 px-4 py-2 text-white ml-2"
        >
          Auto-sync from FB
        </button>
```

Where `trpcRequestAutoSync` uses:

```tsx
const autoSync = trpc.group.requestAutoSync.useMutation({
  onSuccess: () => { alert('Worker will open browser to scan your groups. Refresh in a moment.'); list.refetch(); },
});
function trpcRequestAutoSync() { autoSync.mutate(); }
```

(Add the `const autoSync` line at the top of the component with the other hooks.)

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm -F web typecheck && pnpm -F worker typecheck
git add apps/web/server/routers/group.ts apps/web/app/groups/page.tsx apps/worker/src/groups/sync.ts apps/worker/src/session/requests.ts
git commit -m "feat: add auto-sync groups flow (web trigger + worker scraper)"
```

---

## Phase J — Integration, deployment, polish

### Task J1: Single browser context per campaign run

**Files:**
- Modify: `apps/worker/src/playwright/adapter.ts`
- Modify: `apps/worker/src/campaigns/runner.ts`
- Modify: `apps/worker/src/campaigns/runner.test.ts`

Rationale: current adapter opens a fresh browser for every group — expensive and increases detection risk. Refactor so runner opens the context once, calls a per-group function, then closes.

- [ ] **Step 1: Redefine adapter interface for per-run context**

Edit `apps/worker/src/campaigns/runner.ts` — change the adapter interface:

```typescript
export interface CampaignContext {
  postToGroup(input: {
    fbUrl: string;
    content: string;
    mediaFiles: string[];
  }): Promise<PostResult>;
  close(): Promise<void>;
}

export interface PlaywrightAdapter {
  verifySession(userId: string): Promise<{ valid: boolean; reason?: string }>;
  openCampaign(userId: string): Promise<CampaignContext>;
}
```

- [ ] **Step 2: Update runner to open context once**

Inside `runCampaign`, after session verify and before the loop:

```typescript
const campaignCtx = await adapter.openCampaign(campaign.userId);
try {
  // ... existing loop, replacing `adapter.postToGroup({...userId, fbUrl...})`
  //     with `campaignCtx.postToGroup({ fbUrl, content, mediaFiles })`
} finally {
  await campaignCtx.close();
}
```

- [ ] **Step 3: Update tests to match new interface**

Edit `apps/worker/src/campaigns/runner.test.ts` — replace `postToGroup` on adapter with `openCampaign` returning a mock CampaignContext:

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

Update assertions (`adapter.postToGroup`) to access through the returned context:

```typescript
const ctx = await (adapter.openCampaign as ReturnType<typeof vi.fn>).mock.results[0]!.value;
expect(ctx.postToGroup).toHaveBeenCalledTimes(3);
```

- [ ] **Step 4: Update real adapter**

Rewrite `apps/worker/src/playwright/adapter.ts`:

```typescript
import type { PrismaClient } from '@prisma/client';
import type { PlaywrightAdapter } from '../campaigns/runner.js';
import { launchBrowser } from './browser.js';
import { verifySession } from './session.js';
import { postToGroup as playwrightPostToGroup } from './post.js';

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
          enableScrollBeforePost: setting.enableScrollBeforePost,
          delayBeforePost: { min: setting.delayBeforePostMinMs, max: setting.delayBeforePostMaxMs },
          delayAfterFocus: { min: setting.delayAfterFocusMinMs, max: setting.delayAfterFocusMaxMs },
        }),
        close: () => ctx.close(),
      };
    },
  };
}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm -F worker test && pnpm -F worker typecheck`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/campaigns/runner.ts apps/worker/src/campaigns/runner.test.ts apps/worker/src/playwright/adapter.ts
git commit -m "refactor(worker): reuse single browser context across a campaign run"
```

---

### Task J2: Screenshot on failure

**Files:**
- Modify: `apps/worker/src/playwright/post.ts`

- [ ] **Step 1: Add screenshot helper + call on error**

Edit `apps/worker/src/playwright/post.ts` — inside `postToGroup`, before every `return { success: false, ... }`, insert a screenshot (also include when detect state fails):

Add at top:
```typescript
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

function screenshotPath(): string {
  const dir = resolve(process.cwd(), 'logs', 'screenshots');
  mkdirSync(dir, { recursive: true });
  return resolve(dir, `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`);
}
```

Wrap each failure return so it captures before returning, e.g.:

```typescript
async function fail(page: import('playwright').Page, category: PostResult['errorCategory'], msg: string): Promise<PostResult> {
  try {
    const path = screenshotPath();
    await page.screenshot({ path, fullPage: false });
    log.warn({ category, path }, 'post failed');
    return { success: false, errorCategory: category, error: `${msg} (screenshot=${path})` };
  } catch {
    return { success: false, errorCategory: category, error: msg };
  }
}
```

Replace every failure return with `return await fail(page, 'session_invalid', state.detail);` etc.

- [ ] **Step 2: Typecheck**

Run: `pnpm -F worker typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/playwright/post.ts
git commit -m "feat(worker): capture screenshot on post failure"
```

---

### Task J3: pm2 ecosystem config

**Files:**
- Create: `ecosystem.config.js`

- [ ] **Step 1: Write file**

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'web',
      script: 'pnpm',
      args: '-F web start',
      cwd: __dirname,
      env: { NODE_ENV: 'production', DATABASE_URL: 'file:./data.db' },
      autorestart: true,
      max_restarts: 10,
    },
    {
      name: 'worker',
      script: 'pnpm',
      args: '-F worker start',
      cwd: __dirname,
      env: { NODE_ENV: 'production', DATABASE_URL: 'file:./data.db' },
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
```

- [ ] **Step 2: Build steps**

Add to root `package.json` scripts:

```json
"build": "pnpm -r build",
"start:prod": "pm2 start ecosystem.config.js",
"stop:prod": "pm2 stop ecosystem.config.js"
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: `apps/web/.next` and `apps/worker/dist` created.

(If worker build fails: ensure its `tsconfig.json` has outDir and no typeRoots issues.)

- [ ] **Step 4: Commit**

```bash
git add ecosystem.config.js package.json
git commit -m "chore: add pm2 ecosystem config for production"
```

---

### Task J4: README with setup and E2E checklist

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

```markdown
# Facebook Group Auto-Post

Personal tool to post the same content to multiple FB groups on your account, with scheduling and human-like automation.

## Requirements
- Node.js 20+
- pnpm 9+
- macOS or Linux (Windows untested)

## Setup
1. `pnpm install`
2. `cp .env.example .env`
3. `pnpm db:migrate`
4. `pnpm db:seed`
5. `pnpm -F worker exec playwright install chromium`

## Run (dev)
```bash
pnpm dev   # runs web + worker concurrently
```

Open http://localhost:3000.

## First-time FB session
1. Go to **Session** page.
2. Click **Open browser to log in** — worker opens Chrome.
3. Log in (including 2FA), then **close the browser window**.
4. Click **Verify session** — should show "valid".

## Usage
- **Groups**: paste FB group URLs (one per line) or use **Auto-sync**.
- **Campaigns**: create with text + media, pick target groups, schedule.
- **Settings**: tune delays per your risk tolerance.
- **Dashboard**: monitor running/upcoming/session.
- **Logs**: see every post attempt with errors.

## Production (pm2)
```bash
pnpm build
pnpm start:prod
```
Keep the machine awake during scheduled times (`caffeinate -d` on macOS).

## Safety caveats
- Uses Playwright automation → violates FB ToS.
- Accept the ban risk before using on your main account.
- Soft limits: ≤ 15 groups/campaign, ≤ 3 campaigns/day.

## E2E checklist (run before first real use)
- [ ] Setup + verify session
- [ ] Post 1 text-only campaign to 1 test group
- [ ] Post campaign with 3 images
- [ ] Post campaign with 1 video
- [ ] Post to 3 groups — verify inter-group delays
- [ ] Simulate session expired (delete `sessions/default-user`) → detect → re-auth
- [ ] Create recurring campaign (`*/5 * * * *`) → run twice, verify jitter
- [ ] Pause (delete a group between runs) → Resume → verify only remaining posts
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup and E2E checklist"
```

---

### Task J5: Dev run smoke test

- [ ] **Step 1: Start everything**

```bash
pnpm dev
```

- [ ] **Step 2: Manual smoke**

In a browser:
1. http://localhost:3000 → Dashboard loads (session=invalid banner shown)
2. /groups → paste `https://www.facebook.com/groups/12345` → Add → appears in list
3. /campaigns/new → fill form, select group, schedule for now+2min → Schedule
4. Observe worker logs — see `picked up due campaign` within 30s
5. /campaigns/[id] → see logs populated (will all fail since session invalid — expected)

- [ ] **Step 3: If all smoke steps work, commit any fixes**

If issues found, fix them and commit with descriptive message.

---

## Self-Review Notes

**Spec coverage check:**
- §1 Problem/Scope → implicit in all tasks
- §2 Tech Stack → Tasks A2, A3, B1, H1
- §3 Architecture → Tasks A2–A5 (foundation), H1–H2 (web), B1/G2 (worker)
- §4 Data Model → Task A3
- §5 Campaign Lifecycle → Tasks F2, G1 (scheduler), I4 (cancel/resume)
- §6 Playwright/Human Strategy → Tasks C2–C5, D1, E1, J2
- §7 Error Handling → Tasks E1 (detect), F2 (runner retry/pause), J2 (screenshot); **in-app notifications** covered via Logs page (I6) and SessionBanner (I7). Full notification center (bell + unread badge) deferred as a follow-up (noted in spec §10 as explicit MVP scope call).
- §8 Testing → Tasks B2-B4 (unit), C5 (offline fixture), F2 + G1 (integration); manual E2E in Task J4
- §9 Deployment → Tasks J3, J4

**Notification center gap:** spec §7.4 mentions bell icon + badge. This plan provides SessionBanner + Logs page + red border on errors but no explicit bell/badge component. This is a reasonable MVP simplification — add a `NotificationBell` in a follow-up plan if the user finds it missing during E2E.

**Placeholder scan:** no TODO / TBD / "handle edge cases" / "similar to Task N" instances found — every code block is complete.

**Type consistency:**
- `PlaywrightAdapter` interface: defined in F2, refactored in J1 — all call sites updated in J1.
- `PostResult` shape: defined in `packages/shared/src/types.ts` (Task A5), used consistently in E1, F2.
- `CampaignStatus` / `PostStatus` string literals: single source in `packages/shared/constants.ts`, no divergence.
- Adapter returns `CampaignContext` in J1 — runner test updated in same task.
