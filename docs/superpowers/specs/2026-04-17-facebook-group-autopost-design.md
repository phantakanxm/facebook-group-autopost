# Facebook Group Auto-Post — Design Spec

**Date:** 2026-04-17
**Status:** Draft (awaiting user review)
**Owner:** phantakan.mongkol@gmail.com

## 1. Problem & Scope

ต้องการระบบโพสต์ Facebook อัตโนมัติจากบัญชีส่วนตัวไปยังหลายกลุ่มที่ user เป็นสมาชิกอยู่แล้ว
เนื้อหาโพสต์เดียวกันทุกกลุ่ม รองรับรูปและวิดีโอ มี scheduling และพฤติกรรมคล้ายมนุษย์เพื่อลดความเสี่ยงจากการถูก FB ล็อก/แบนบัญชี

### In scope
- บัญชีส่วนตัว single-user (แต่ data model เตรียม multi-user ไว้)
- โพสต์ข้อความ (plain text + emoji + ลิงก์) พร้อมรูป (สูงสุด 10 รูป) **หรือ** วิดีโอ 1 ตัว
- Scheduling แบบ one-time และ recurring (cron + jitter)
- เลือกกลุ่มแบบ manual (paste URL) และ auto-sync (scrape จาก FB) — hybrid
- Web UI local (`localhost:3000`) + worker process แยก
- พฤติกรรม human-like (paste, mouse curve, delay แบบสุ่ม) พร้อม configurable settings
- Error handling: smart retry, smart pause, resume, session expiry detection

### Out of scope (Phase 2+)
- Multi-user auth system (login/password, JWT)
- Billing/subscription
- ย้าย deploy ไป VPS (ออกแบบให้รองรับ แต่ไม่ setup ใน MVP)
- Webhook notifications (LINE/Discord/email)
- โพสต์ได้ใน comment/replies, page, story
- AI-assisted content generation

### ความเสี่ยง (รับทราบ)
- Browser automation ขัด Facebook Terms of Service บัญชีอาจโดนจำกัด/ระงับ
- User ยอมรับความเสี่ยงนี้ แนวทาง mitigate ด้วย human-like behavior และขนาด campaign จำกัด

## 2. Tech Stack

| ส่วน | เลือก |
|---|---|
| Language | TypeScript |
| Runtime | Node.js ≥ 20 |
| Monorepo | pnpm workspaces |
| Web framework | Next.js 15 (App Router) |
| API layer | tRPC |
| Browser automation | Playwright + `playwright-extra` + stealth plugin |
| Database | SQLite (Prisma ORM — พร้อมย้าย PostgreSQL) |
| Scheduler | `node-cron` + DB polling (30s interval) |
| Process manager | `pm2` (prod) / `concurrently` (dev) |
| Logging | `pino` (structured) + file rotation |
| Validation | Zod (shared schemas) |
| Testing | Vitest (unit/integration) + manual E2E checklist |

## 3. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      User's Machine                          │
│                                                              │
│  ┌────────────────┐         ┌────────────────────────────┐   │
│  │  Web UI        │         │  Worker Process            │   │
│  │  (Next.js)     │         │  (Node.js long-running)    │   │
│  │  localhost:3000│         │                            │   │
│  │                │         │  ┌─────────────────────┐   │   │
│  │  - Dashboard   │         │  │ Scheduler           │   │   │
│  │  - Campaigns   │         │  │ (node-cron)         │   │   │
│  │  - Groups      │         │  │ - poll DB every 30s │   │   │
│  │  - Settings    │         │  │ - fire due campaigns│   │   │
│  │  - Logs        │         │  └──────────┬──────────┘   │   │
│  └───────┬────────┘         │             │              │   │
│          │ tRPC             │             ▼              │   │
│          ▼                  │  ┌─────────────────────┐   │   │
│  ┌────────────────┐         │  │ Playwright Runner   │   │   │
│  │  API Routes    │◄────────┤  │ - load session      │   │   │
│  │  (Next.js)     │         │  │ - post to groups    │   │   │
│  └───────┬────────┘         │  │ - human-like delays │   │   │
│          │                  │  │ - retry logic       │   │   │
│          │                  │  └──────────┬──────────┘   │   │
│          │                  │             │              │   │
│          ▼                  │             ▼              │   │
│  ┌─────────────────────────────────────────────────┐         │
│  │  SQLite (data.db) — shared via Prisma Client    │         │
│  │  + uploads/ + sessions/                         │         │
│  └─────────────────────────────────────────────────┘         │
│                                                              │
│  Managed by: pm2 (auto-start, auto-restart)                  │
└──────────────────────────────────────────────────────────────┘
```

### Key choices
- **แยก Web และ Worker เป็น 2 processes** — Playwright crash ไม่กระทบ Web UI, worker รันได้แม้ Web UI ปิด
- **ใช้ DB เป็น message bus** — Web เขียน `Campaign.status='scheduled'` → Worker poll ทุก 30s, หยิบ campaign ที่ `scheduledAt <= now()` มารัน
- **ไม่ใช้ Redis/BullMQ ใน MVP** — single-user, single-worker ไม่ต้องการ distributed queue
- **1 campaign ทีละ เวลา** — scheduler query `LIMIT 1` เสมอ ป้องกันเปิด browser หลายตัวพร้อมกัน

### Monorepo structure
```
facebook-post-automation/
├── apps/
│   ├── web/              # Next.js 15 (UI + tRPC API)
│   │   ├── app/
│   │   ├── components/
│   │   └── server/
│   └── worker/           # Node.js entrypoint
│       ├── src/
│       │   ├── scheduler.ts
│       │   ├── playwright/
│       │   │   ├── browser.ts
│       │   │   ├── human.ts
│       │   │   ├── post.ts
│       │   │   ├── detect.ts
│       │   │   └── selectors.ts
│       │   └── main.ts
│       └── package.json
├── packages/
│   ├── db/               # Prisma schema + client
│   └── shared/           # Zod schemas, types, constants
├── uploads/              # {campaignId}/{filename}
├── sessions/             # {userId}/ (Playwright persistent context)
├── logs/
│   ├── worker-YYYY-MM-DD.log
│   └── screenshots/
├── data.db
├── ecosystem.config.js   # pm2 config
└── pnpm-workspace.yaml
```

## 4. Data Model (Prisma Schema)

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "sqlite"; url = "file:../../data.db" }

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
  id         String   @id @default(cuid())
  userId     String
  fbGroupId  String
  fbUrl      String
  name       String?
  isActive   Boolean  @default(true)
  source     String   // "manual" | "auto_sync"
  lastPosted DateTime?
  createdAt  DateTime @default(now())

  user      User       @relation(fields: [userId], references: [id])
  postLogs  PostLog[]
  campaigns CampaignGroup[]

  @@unique([userId, fbGroupId])
}

model Campaign {
  id            String    @id @default(cuid())
  userId        String
  title         String?
  content       String
  mediaFiles    String    // JSON array of file paths
  mediaType     String    // "none" | "images" | "video"

  scheduledAt   DateTime
  recurrence    String?   // cron expression, null = one-time
  jitterMinutes Int       @default(15)

  status        String    // draft | scheduled | running | completed | failed | paused
  startedAt     DateTime?
  completedAt   DateTime?
  lastError     String?

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  user   User             @relation(fields: [userId], references: [id])
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
  id          String   @id @default(cuid())
  campaignId  String
  groupId     String
  attempt     Int      @default(1)
  status      String   // pending | success | failed | skipped
  note        String?  // "pending_approval" ฯลฯ
  error       String?
  fbPostUrl   String?
  startedAt   DateTime?
  completedAt DateTime?
  createdAt   DateTime @default(now())

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

### Notes
- ทุกตารางมี `userId` รองรับ multi-user ในอนาคต
- `mediaFiles` เก็บเป็น JSON string (SQLite ไม่รองรับ `String[]` native)
- Session file อยู่นอก DB ที่ `sessions/{userId}/` (Playwright persistent context directory)

## 5. Campaign Lifecycle

### State machine
```
[draft] ──schedule──▶ [scheduled]
                          │
                          ▼ (worker poll)
                      [running]
                      │       │
             success  │       │  consecutive-fail (≥3)
                      ▼       ▼
                [completed] [paused] ──(user resume)──▶ [scheduled]
                      │
                  recurring? ──▶ [scheduled] (next run)

    Session invalid / account locked ──▶ [paused] (all campaigns)
```

### Posting flow (per campaign)
1. Scheduler หยิบ campaign → `UPDATE status='running', startedAt=now()` (atomic lock)
2. Load Playwright session → verify ว่า login อยู่ (visit `/me`)
   - Session invalid → pause campaign, mark `sessionValid=false`, notify
3. Apply jitter: sleep สุ่ม ± `jitterMinutes`
4. ลูปแต่ละกลุ่มตาม `CampaignGroup.order`:
   - สร้าง PostLog (`status='pending'`)
   - Navigate → scroll random → click composer
   - Paste content → upload media (ถ้ามี) → wait upload complete
   - Human click Post → verify ผลสำเร็จ (โพสต์ปรากฏ / "pending approval") หรือ detect error
   - Update PostLog + `Group.lastPosted`
   - ถ้า fail: retry ตาม `maxRetryPerGroup` → ถ้ายัง fail = skipped
   - ถ้า consecutive fails ≥ `stopAfterConsecutiveFailures` → pause campaign
   - Sleep `delayBetweenGroups` (min–max สุ่ม)
5. Finalize: ถ้า recurring → คำนวณ next `scheduledAt` + jitter → `status='scheduled'`; ถ้า one-time → `completed`

### Resume
- User กดปุ่ม "Resume" ใน Web UI
- API: set `scheduledAt = now() + 5 min`, `status='scheduled'`, reset consecutive-fail counter
- Worker หยิบมารัน โพสต์เฉพาะกลุ่มที่ `PostLog.status != 'success'` (หรือยังไม่มี log)

## 6. Playwright / Human-like Strategy

### Browser setup
- `chromium.launchPersistentContext()` กับ stealth plugin
- Headed mode เป็น default (headless ถูก FB ตรวจง่ายกว่า)
- Thai locale + Asia/Bangkok timezone + realistic User-Agent
- Args ปิด `--disable-blink-features=AutomationControlled`

### Human action toolkit (`apps/worker/src/playwright/human.ts`)
- `humanDelay(min, max)` — random with ±20% gaussian-like variance
- `humanMouseMove(page, x, y)` — Bezier curve 3-point, 20-35 steps, 10-30ms/step
- `humanClick(page, selector)` — hover (ไม่กึ่งกลางเป๊ะ) + delay 200-500ms + click
- `humanPaste(page, text)` — clipboard API + Ctrl+V (fallback `insertText`)
- `humanScroll(page)` — scroll ลงแบบ stepped + pause "อ่าน" + scroll กลับบางส่วน

### Posting sequence
`goto → scroll → click composer → delay → paste → delay → upload media → delay → mouse move to Post → delay → click Post → verify`

### Selector strategy
- **หลีกเลี่ยง** class names (FB generate ใหม่ทุก deploy)
- **ใช้** `role=button[name=/pattern/]` กับ accessible name (stable สำหรับ a11y)
- Pattern รองรับทั้ง locale ไทย/อังกฤษ
- ศูนย์รวม selector ใน `selectors.ts` แก้จุดเดียว
- Fallback chain (primary + secondary selector)

### Safety limits
- Warning ถ้า campaign > 15 กลุ่ม
- Warning ถ้า scheduled > 3 campaigns/วัน
- ไม่ login อัตโนมัติเมื่อ session หมด (แจ้ง user มา login เอง)

## 7. Error Handling

### Error categories
| Category | Trigger | Response |
|---|---|---|
| Session invalid | cookies expired, redirect `/login` | Pause campaign, mark `sessionValid=false`, banner ใน UI |
| Account locked | checkpoint/captcha page | Pause **ทุก** campaign, critical alert |
| Group-specific approval hold | "pending admin approval" | PostLog `status='success'`, `note='pending_approval'` |
| Group inactive | ถูก remove จากกลุ่ม / กลุ่มถูกลบ | `Group.isActive=false`, PostLog `status='skipped'` |
| Transient (network/timeout) | navigation timeout | Retry ตาม settings |
| Rate limited | "Going Too Fast" | Pause campaign + cooldown 1 ชม. + notify |
| Selector not found | FB UI เปลี่ยน | Screenshot + fail + alert (dev fix) |
| Upload failed | size/format issue | Validate ก่อน upload + runtime fail = skip group |

### Detection function
```typescript
detectFBState(page) → 'ok' | 'session_invalid' | 'account_locked' 
                    | 'rate_limited' | 'group_unavailable'
```
เรียกก่อน/หลัง navigate และ click Post ทุกครั้ง

### Logging
- Structured logs ด้วย `pino` → console + `logs/worker-YYYY-MM-DD.log` (rotate 7 วัน)
- Screenshot on fail → `logs/screenshots/{campaignId}-{timestamp}.png` (เก็บ 14 วัน)
- ไม่ log ข้อความโพสต์เต็ม (privacy) — เก็บแค่ 50 chars แรก

### Notifications (MVP = in-app)
- Bell icon + badge count ใน navbar
- Notifications page (history)
- Red banner สำหรับ critical (session invalid, account locked)
- Toast สำหรับ event ระหว่าง user เปิดแอป (polling 10s หรือ SSE)
- Phase 2: webhook (LINE/Discord/email)

### Recovery flows
- **Session expired**: detect → pause all scheduled → banner → user กด re-auth → headed browser → verify → resume paused
- **Campaign paused**: แสดงใน "Needs Attention" → user ดู PostLog → กด Resume (หรือ skip บางกลุ่มก่อน resume)

### Dashboard
หน้าแรกแสดง: session status, running now (progress X/Y), upcoming 7 วัน, success rate 7 วันล่าสุด, active alerts

## 8. Testing Strategy

### Pyramid
- **Unit (Vitest)** — pure functions: delays, Bezier curve, cron + jitter, Zod validators, selector builders
- **Integration (Vitest + in-memory SQLite)** — scheduler loop, state machine, retry/pause/resume, session validation flow. Mock Playwright layer ทั้งก้อน
- **Playwright offline** — เก็บหน้า FB group เป็น fixture HTML → test selectors, human actions ด้วย `file://` URL
- **Manual E2E** — บน test account ก่อน deploy ทุกครั้ง

### E2E checklist
- Setup session (login + 2FA)
- Post 1 group → ขึ้นจริง
- Post 3 groups → delay ถูก, ทุกกลุ่มสำเร็จ
- Post with 3 images → รูปขึ้นถูก
- Post with video → วิดีโอขึ้นถูก
- Simulate session expired → detect + re-auth flow
- Recurring: ครั้งที่ 2 auto-run, jitter ต่าง
- Resume paused → โพสต์เฉพาะกลุ่มที่ยังไม่สำเร็จ

### CI/CD (minimal)
- GitHub Actions: unit + integration tests, TypeScript check, Prisma migrate validate
- **ไม่ run** Playwright E2E บน CI (ต้อง login FB)
- Pre-commit hook: format + lint

### Production observability
- Success rate ตกฮวบ = อาจเป็น FB UI change
- Selector-not-found ≥ 2 ครั้ง/วัน → red alert

## 9. Deployment & Runtime

### Dev
```bash
pnpm install
pnpm db:migrate
pnpm dev   # concurrently: web + worker
```

### Prod (local machine = MVP)
```bash
pnpm build
pm2 start ecosystem.config.js   # auto-start on boot, auto-restart
```

`ecosystem.config.js` defines 2 apps:
- `web` — Next.js server (port 3000)
- `worker` — Node.js worker (scheduler + Playwright)

### Prod (VPS — Phase 2)
- เหมือน local + nginx reverse proxy
- Playwright บน Linux: apt packages สำหรับ Chromium headless; headless mode ต้อง test กับ FB ดีๆ
- Backup `data.db` + `sessions/` + `uploads/` ผ่าน cron → rclone/restic

### Runtime requirement
- Mac/PC ต้องไม่ sleep ช่วงเวลาที่ตั้ง schedule (เสียบปลั๊ก + `caffeinate` บน Mac หรือ power settings)
- Session file ต้อง backup (ถ้าหาย = ต้อง login ใหม่)

## 10. Open Questions / Future Decisions

(ยืนยันว่าตอนนี้ไม่มี — ทุกข้อ converged ใน brainstorming)

Phase 2 candidates:
- Multi-user auth + admin panel
- LINE/Discord webhook notifications
- AI content variation per group (reduce FB spam detection)
- Analytics dashboard (reach, engagement per group)
- Mobile-friendly UI

## 11. Success Criteria

- ✅ User สามารถ setup session ครั้งเดียวและใช้งานต่อเนื่องเป็นเดือน
- ✅ โพสต์ไปยัง 10 กลุ่มสำเร็จ ≥ 90% ในแต่ละ campaign
- ✅ บัญชี FB ไม่ถูก lock/ban ตลอดการใช้งานปกติ (ภายใต้ safety limits)
- ✅ Scheduled campaign ยิงตรงเวลา (± jitter) ≥ 95%
- ✅ User ได้รับ alert ภายใน 1 นาทีเมื่อเกิด critical error (session invalid, account locked)
- ✅ ระบบ recover จาก session expiry ภายใน 5 นาทีหลัง user re-authenticate
