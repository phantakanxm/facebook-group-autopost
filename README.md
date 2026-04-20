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

Open http://localhost:3100.

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
