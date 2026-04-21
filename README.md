# Facebook Group Auto-Post

Personal tool to post the same content to multiple FB groups on your account, with scheduling and human-like automation.

## Desktop app (end users)

Download the latest installer from the [Releases](https://github.com/phantakanxm/facebook-group-autopost/releases) page.

- **macOS** (`.dmg`): on first launch, right-click the app → **Open** to bypass Gatekeeper. The app is not yet code-signed.
- **Windows** (`.exe`): SmartScreen may warn — click **More info → Run anyway**.
- **Linux** (`.AppImage`): `chmod +x FB*.AppImage` then double-click.

The app auto-updates in the background. When a new version is downloaded, you'll be prompted to restart.

Per-user data is stored at:
- macOS: `~/Library/Application Support/FB Group Autopost/`
- Windows: `%APPDATA%\FB Group Autopost\`
- Linux: `~/.config/FB Group Autopost/`

Contains: `app.db` (SQLite), `uploads/`, `sessions/` (FB cookies), `logs/`.

## Desktop development

```bash
pnpm install
pnpm -F desktop dev   # builds db, worker, web standalone, then opens Electron window
```

The `predev` script auto-builds all sidecar artifacts. For repeat launches without rebuilding, use `pnpm -F desktop dev:fast`.

### Building installers locally

```bash
PLAYWRIGHT_BROWSERS_PATH=./apps/worker/ms-playwright pnpm -F worker exec playwright install chromium
pnpm -F desktop prepack:all   # builds + stages all resources
pnpm -F desktop dist          # builds installer for current platform
```

Output: `apps/desktop/release/`.

## Releasing a new version

CI is wired to GitHub Actions. Tag push → matrix build (Mac/Win/Linux) → publish to GitHub Releases → installed apps auto-update on next launch.

```bash
# 1. Bump version in apps/desktop/package.json (follows semver)
# 2. Commit + tag + push
git add apps/desktop/package.json
git commit -m "chore: release v0.1.1"
git tag v0.1.1
git push origin main --tags
```

CI takes ~15 min. Watch [Actions](https://github.com/phantakanxm/facebook-group-autopost/actions).

After CI completes, installed apps detect the new version within ~30s of next launch and prompt to restart.

---

## Run from source (developers)

### Requirements
- Node.js 20+
- pnpm 9+
- macOS or Linux (Windows untested)

### Setup
1. `pnpm install`
2. `cp .env.example .env`
3. `pnpm db:migrate`
4. `pnpm db:seed`
5. `pnpm -F worker exec playwright install chromium`

### Run (dev)
```bash
pnpm dev   # runs web + worker concurrently
```

Open http://localhost:3100.

### Production (pm2)
```bash
pnpm build
pnpm start:prod
```
Keep the machine awake during scheduled times (`caffeinate -d` on macOS).

---

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

## Safety caveats
- Uses Playwright automation → violates FB ToS.
- Accept the ban risk before using on your main account.
- Soft limits: ≤ 15 groups/campaign, ≤ 3 campaigns/day.

## Known limitations

- **No code signing.** Mac users see Gatekeeper warning, Windows users see SmartScreen. Adding Apple Developer ID ($99/yr) and a Windows EV cert (~$300/yr) would remove these.
- **No in-app "Check for updates" button.** Updates happen silently in background; restart dialog appears only when the download is complete.
- **Don't downgrade.** Newer Prisma schema migrations may not be reversible. Stay on the latest version.

## E2E checklist (run before first real use)
- [ ] Setup + verify session
- [ ] Post 1 text-only campaign to 1 test group
- [ ] Post campaign with 3 images
- [ ] Post campaign with 1 video
- [ ] Post to 3 groups — verify inter-group delays
- [ ] Simulate session expired (delete `sessions/default-user`) → detect → re-auth
- [ ] Create recurring campaign (`*/5 * * * *`) → run twice, verify jitter
- [ ] Pause (delete a group between runs) → Resume → verify only remaining posts
