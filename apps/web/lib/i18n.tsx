'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

/* ================================================================== */

export type Locale = 'en' | 'th';

const DICT = {
  en: {
    /* ---------- Common ---------- */
    'common.loading': 'Loading…',
    'common.confirm': 'OK',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.remove': 'Remove',
    'common.dash': '—',
    'common.never': 'never',
    'common.none': 'None',

    /* ---------- Brand / shell ---------- */
    'brand.name': 'Atelier',
    'brand.tagline': 'Broadcast studio',
    'shell.footer.a': 'Handcrafted dispatches',
    'shell.footer.b': 'Post with intention',
    'shell.appearance': 'Appearance',
    'shell.language': 'Language',
    'shell.session.eyebrow': 'Facebook',
    'shell.session.active': 'Session active',
    'shell.session.invalid': 'Re-authentication required',

    /* ---------- Nav ---------- */
    'nav.dashboard': 'Dashboard',
    'nav.dashboard.hint': 'Today at a glance',
    'nav.campaigns': 'Campaigns',
    'nav.campaigns.hint': 'Scheduled & drafts',
    'nav.groups': 'Groups',
    'nav.groups.hint': 'Dispatch destinations',
    'nav.activity': 'Activity',
    'nav.activity.hint': 'Post history',
    'nav.settings': 'Settings',
    'nav.settings.hint': 'Pacing & safety',
    'nav.session': 'Session',
    'nav.session.hint': 'Facebook account',

    /* ---------- Session banner ---------- */
    'banner.title': 'Facebook session needs attention',
    'banner.desc':
      'The worker cannot publish until the session is re-authenticated. No campaigns will dispatch while this is unresolved.',
    'banner.cta': 'Re-authenticate',

    /* ---------- Dashboard ---------- */
    'dash.greet.late': 'Still up',
    'dash.greet.morning': 'Good morning',
    'dash.greet.afternoon': 'Good afternoon',
    'dash.greet.evening': 'Good evening',
    'dash.greet.night': 'Late night',
    'dash.hero.line1': 'The press is',
    'dash.hero.warm': 'warm',
    'dash.hero.line2': 'What are we dispatching today?',
    'dash.hero.subtitle':
      "Queue new campaigns, check last night's delivery, keep the cadence steady.",
    'dash.compose': 'Compose dispatch',
    'dash.vital.session': 'Session',
    'dash.vital.session.active': 'Active',
    'dash.vital.session.invalid': 'Invalid',
    'dash.vital.session.helper.valid': 'Facebook account connected',
    'dash.vital.session.helper.invalid': 'Re-authentication needed',
    'dash.vital.inflight': 'In flight',
    'dash.vital.inflight.none': 'Nothing dispatching now',
    'dash.vital.paused': 'Paused',
    'dash.vital.paused.clear': 'Queue clear',
    'dash.vital.paused.waiting': 'Waiting for resume',
    'dash.vital.delivery': '7-day delivery',
    'dash.vital.delivered': '{n} delivered',
    'dash.vital.failed': '{n} failed',
    'dash.vital.live': 'live',
    'dash.upcoming.eyebrow': 'Next 7 days',
    'dash.upcoming.title': 'Upcoming dispatches',
    'dash.upcoming.viewAll': 'View all →',
    'dash.upcoming.empty.title': 'Nothing on the schedule',
    'dash.upcoming.empty.desc':
      "When the press is quiet, creativity fills the room. Compose your next dispatch when you're ready.",
    'dash.upcoming.empty.cta': 'Compose dispatch',
    'dash.upcoming.via': 'dispatched via worker',
    'dash.upcoming.scheduled': 'scheduled',
    'dash.pulse.eyebrow': 'Past 7 days',
    'dash.pulse.title': 'Activity pulse',
    'dash.pulse.delivered': 'Delivered',
    'dash.pulse.failed': 'Failed / skipped',
    'dash.pulse.successRate': 'Success rate',
    'dash.shortcuts.eyebrow': 'Quick moves',
    'dash.shortcuts.title': 'Shortcuts',
    'dash.shortcuts.new': 'Compose new dispatch',
    'dash.shortcuts.new.hint': 'Schedule or send now',
    'dash.shortcuts.groups': 'Manage destinations',
    'dash.shortcuts.groups.hint': 'Groups, activation, sync',
    'dash.shortcuts.logs': 'Open activity log',
    'dash.shortcuts.logs.hint': 'Latest 200 entries',
    'dash.shortcuts.settings': 'Adjust pacing',
    'dash.shortcuts.settings.hint': 'Delay, jitter, retry policy',

    /* ---------- Campaigns list ---------- */
    'camps.eyebrow': 'Campaigns',
    'camps.title': 'Every dispatch, on the record',
    'camps.subtitle':
      'Scheduled, running, paused, or complete. The whole roster in one place.',
    'camps.new': 'New campaign',
    'camps.th.title': 'Title',
    'camps.th.status': 'Status',
    'camps.th.scheduled': 'Scheduled',
    'camps.th.groups': 'Groups',
    'camps.empty.title': 'The ledger is empty',
    'camps.empty.desc':
      "Start your first campaign — choose the content, the groups, and when it should leave the press.",
    'camps.empty.cta': 'Compose the first one',

    /* ---------- Campaign detail ---------- */
    'camp.back': 'All campaigns',
    'camp.eyebrow': 'Campaign',
    'camp.untitled': 'Untitled dispatch',
    'camp.scheduledFor': 'Scheduled for',
    'camp.at': 'at',
    'camp.resume': 'Resume',
    'camp.cancel': 'Cancel',
    'camp.lastError': 'Last error',
    'camp.content.eyebrow': 'Content',
    'camp.content.title': 'The message',
    'camp.sent.eyebrow': '{n} destinations',
    'camp.sent.title': 'Sent to',
    'camp.sent.empty': 'No destinations selected.',
    'camp.log.eyebrow': '{n} entries',
    'camp.log.title': 'Delivery log',
    'camp.log.empty':
      'Nothing has been dispatched yet. Entries will appear here once the worker starts posting.',
    'camp.log.th.group': 'Group',
    'camp.log.th.result': 'Result',
    'camp.log.th.attempt': 'Attempt',
    'camp.log.th.error': 'Note / error',
    'camp.log.th.completed': 'Completed',

    /* ---------- Campaign form ---------- */
    'form.eyebrow': 'Compose',
    'form.title': 'A new dispatch',
    'form.subtitle':
      'Words, attachments, audience, timing. Set the intent — the press handles the rest.',
    'form.step01': 'Step 01',
    'form.step02': 'Step 02',
    'form.step03': 'Step 03',
    'form.step04.eyebrow': 'Step 04 · Destinations',
    'form.section.message': 'The message',
    'form.section.attachments': 'Attachments',
    'form.section.timing': 'Timing',
    'form.field.title': 'Title',
    'form.field.title.hint': 'Optional · for your reference only',
    'form.field.title.placeholder': 'e.g. Weekly roundup · week 18',
    'form.field.content': 'Content',
    'form.field.content.hint': '{n} chars',
    'form.field.content.placeholder':
      'Write the post exactly as it should appear in each group. Multiline is fine.',
    'form.field.media': 'Media type',
    'form.media.none': 'No media',
    'form.media.images': 'Images (up to 10)',
    'form.media.video': 'Single video',
    'form.field.upload': 'Upload',
    'form.upload.count': '{n} files uploaded',
    'form.upload.browse': 'Drag files in or click to browse',
    'form.upload.chooseImages': 'Click to choose images',
    'form.upload.chooseVideo': 'Click to choose a video',
    'form.field.dispatchAt': 'Dispatch at',
    'form.field.jitter': 'Jitter (± minutes)',
    'form.field.jitter.helper': 'Small randomisation hides the machine.',
    'form.field.recurrence': 'Recurrence',
    'form.field.recurrence.helper':
      'Cron expression · leave blank for one-off',
    'form.dest.eyebrow': 'Step 04 · Destinations',
    'form.dest.title': 'Target groups',
    'form.dest.selectAll': 'Select all',
    'form.dest.clear': 'Clear',
    'form.dest.noActive.before': 'No active groups. Add groups first on the ',
    'form.dest.noActive.link': 'Groups',
    'form.dest.noActive.after': ' page.',
    'form.submit': 'Schedule dispatch',
    'form.submitting': 'Scheduling…',
    'form.footer':
      'A confirmation will appear once the queue accepts the job.',

    /* Form confirm/toast */
    'form.toast.noGroups': 'No groups selected',
    'form.toast.noGroups.desc':
      'Select at least one destination group before sending.',
    'form.confirm.eyebrow': 'Confirm dispatch',
    'form.confirm.title': 'Confirm scheduling?',
    'form.confirm.desc.to': 'Will send to',
    'form.confirm.desc.groups': 'groups',
    'form.confirm.desc.on': 'on',
    'form.confirm.desc.recurring': 'recurring on cron',
    'form.confirm.cta': 'Schedule',
    'form.toast.success': 'Dispatch scheduled',
    'form.toast.success.desc': 'Sent to {n} groups · {when}',
    'form.toast.fail': 'Failed to schedule',

    /* Resume/cancel */
    'confirm.resume.eyebrow': 'Resume campaign',
    'confirm.resume.title': 'Resume this campaign?',
    'confirm.resume.desc':
      'The campaign will unpause and continue from where it stopped.',
    'confirm.resume.cta': 'Resume',
    'toast.resume.ok': 'Resumed',
    'toast.resume.ok.desc': 'The campaign is running again.',
    'toast.resume.fail': 'Resume failed',

    'confirm.cancel.eyebrow': 'Cancel campaign',
    'confirm.cancel.title': 'Cancel this campaign?',
    'confirm.cancel.desc':
      'Once cancelled, the campaign will not dispatch and cannot be resumed.',
    'confirm.cancel.cta': 'Cancel campaign',
    'confirm.cancel.keep': 'Keep it',
    'toast.cancel.ok': 'Campaign cancelled',
    'toast.cancel.fail': 'Cancel failed',

    /* ---------- Groups ---------- */
    'groups.eyebrow': 'Destinations',
    'groups.title': 'Where the dispatches land',
    'groups.subtitle':
      'Manage the list of Facebook groups. Activate the ones you want to reach on the next campaign; pause any that need a rest.',
    'groups.autosync': 'Auto-sync from Facebook',
    'groups.add.eyebrow': 'Add by URL',
    'groups.add.title': 'Paste group links',
    'groups.add.detected': '{n} detected',
    'groups.add.helper':
      'One URL per line · facebook.com/groups/… format is fine',
    'groups.add.button': 'Add {n} group',
    'groups.add.button.plural': 'Add {n} groups',
    'groups.add.button.empty': 'Add groups',
    'groups.add.adding': 'Adding…',
    'groups.summary.eyebrow': 'Summary',
    'groups.summary.title': 'Roster',
    'groups.summary.active': 'Active',
    'groups.summary.active.helper': 'Eligible for next dispatch',
    'groups.summary.total': 'Total',
    'groups.summary.total.helper': 'In the roster',
    'groups.roster.eyebrow': '{n} in roster',
    'groups.roster.title': 'The roster',
    'groups.roster.empty.title': 'No groups yet',
    'groups.roster.empty.desc':
      'Paste Facebook group URLs above, or use auto-sync to import from your membership list.',
    'groups.th.status': 'Status',
    'groups.th.group': 'Group',
    'groups.th.url': 'URL',
    'groups.th.capability': 'Capability',
    'groups.th.lastPosted': 'Last posted',

    /* Group confirm/toast */
    'confirm.groups.add.eyebrow': 'Add groups',
    'confirm.groups.add.title': 'Add {n} groups?',
    'confirm.groups.add.desc':
      'Duplicate URLs will be detected and skipped automatically.',
    'confirm.groups.add.cta': 'Add groups',
    'toast.groups.add.ok': 'Groups added',
    'toast.groups.add.desc': 'Added {c} · skipped {s}',
    'toast.groups.add.fail': 'Failed to add groups',

    'confirm.groups.sync.eyebrow': 'Auto-sync',
    'confirm.groups.sync.title': 'Open browser to scan your groups?',
    'confirm.groups.sync.desc':
      'Worker will open a Chrome window on your machine to read the groups you belong to. This may take a moment.',
    'confirm.groups.sync.cta': 'Start scan',
    'toast.groups.sync.ok': 'Scan started',
    'toast.groups.sync.ok.desc':
      'Worker is opening the browser. Refresh in a moment.',
    'toast.groups.sync.fail': 'Failed to start scan',

    'confirm.groups.remove.eyebrow': 'Remove group',
    'confirm.groups.remove.title': 'Remove "{name}"?',
    'confirm.groups.remove.desc':
      'This group will be removed from destinations. Future campaigns will not reach it.',
    'confirm.groups.remove.cta': 'Remove',
    'confirm.groups.remove.keep': 'Keep it',
    'toast.groups.remove.ok': 'Group removed',
    'toast.groups.remove.fail': 'Failed to remove',

    'toast.groups.enable.ok': 'Group activated',
    'toast.groups.disable.ok': 'Group paused',
    'toast.groups.toggle.fail': 'Failed to change status',

    'groups.action.scanCapabilities': 'Scan listing capabilities',
    'groups.action.scanCapabilities.alert': 'Worker will open browser and scan each group — this takes ~5-10 seconds per group. Refresh this page when done.',
    'groups.badge.listingOk': 'Listing',
    'groups.badge.listingNo': 'Text only',
    'groups.badge.notScanned': 'Not scanned',

    'confirm.groups.scan.eyebrow': 'Scan capabilities',
    'confirm.groups.scan.title': 'Scan listing capabilities?',
    'confirm.groups.scan.desc': 'Worker will open browser and scan each group — this takes ~5-10 seconds per group. Refresh this page when done.',
    'confirm.groups.scan.cta': 'Start scan',
    'toast.groups.scan.ok': 'Scan started',
    'toast.groups.scan.ok.desc': 'Worker is scanning groups. Refresh in a moment.',
    'toast.groups.scan.fail': 'Failed to start scan',

    /* ---------- Logs ---------- */
    'logs.eyebrow': 'Activity',
    'logs.title': 'Everything the press has done',
    'logs.subtitle':
      'The 200 most recent delivery events, newest first. Success, failure, retries — all of it, unfiltered.',
    'logs.empty.title': 'The record is blank',
    'logs.empty.desc':
      'Once you dispatch your first campaign, every delivery attempt will land here.',
    'logs.th.when': 'When',
    'logs.th.campaign': 'Campaign',
    'logs.th.group': 'Group',
    'logs.th.result': 'Result',
    'logs.th.attempt': 'Attempt',
    'logs.th.error': 'Error',

    /* ---------- Settings ---------- */
    'settings.eyebrow': 'Pacing & safety',
    'settings.title': 'The rules of the press',
    'settings.subtitle':
      "Human-like delays, retries, and behavioural jitter. Raise them to play it safer; lower them only if you know what you're doing.",
    'settings.save': 'Save settings',
    'settings.saving': 'Saving…',
    'settings.timing.eyebrow': 'Timing',
    'settings.timing.title': 'Delays (milliseconds)',
    'settings.pair.min': 'Min',
    'settings.pair.max': 'Max',
    'settings.pair.ms': 'ms',
    'settings.delay.groups': 'Delay between groups',
    'settings.delay.groups.hint': 'Pause between posting to each group',
    'settings.delay.post': 'Delay before click Post',
    'settings.delay.post.hint': 'Wait after typing before clicking Post',
    'settings.delay.focus': 'Delay after focus composer',
    'settings.delay.focus.hint': 'Wait after the composer opens',
    'settings.delay.retry': 'Retry delay',
    'settings.delay.retry.hint': 'Wait after a failure before trying again',
    'settings.listing.delay': 'Listing: delay between batches',
    'settings.listing.delay.hint': 'Pause between batch dispatches to listing posts',
    'settings.retry.eyebrow': 'Retries',
    'settings.retry.title': 'Failure policy',
    'settings.retry.max': 'Max retry per group',
    'settings.retry.max.hint':
      'How many attempts before giving up on a single group',
    'settings.retry.stop': 'Stop after consecutive failures',
    'settings.retry.stop.hint':
      'Safety valve — pause the whole campaign if too many fail in a row',
    'settings.behaviour.eyebrow': 'Behaviour',
    'settings.behaviour.title': 'Humanising touches',
    'settings.toggle.mouse': 'Curved mouse movement',
    'settings.toggle.mouse.hint':
      'Simulate natural pointer paths between elements',
    'settings.toggle.scroll': 'Scroll before posting',
    'settings.toggle.scroll.hint':
      'Scroll the group feed briefly before opening the composer',
    'settings.toggle.jitter': 'Schedule jitter',
    'settings.toggle.jitter.hint':
      'Shift each post by the jitter window you set per campaign',
    'settings.listing.eyebrow': 'Listing campaigns',
    'settings.listing.title': 'Batch controls',
    'settings.listing.maxbatches': 'Max batches per day',
    'settings.listing.maxbatches.hint': 'Soft warning — will flag if exceeding this daily batch count',

    'confirm.settings.eyebrow': 'Save settings',
    'confirm.settings.title': 'Save new settings?',
    'confirm.settings.desc':
      'Pacing and safety settings apply to campaigns that have not yet dispatched.',
    'confirm.settings.cta': 'Save',
    'toast.settings.ok': 'Settings saved',
    'toast.settings.ok.desc': 'New values take effect immediately.',
    'toast.settings.fail': 'Failed to save',

    /* ---------- Session ---------- */
    'session.eyebrow': 'Account',
    'session.title': 'Facebook session',
    'session.subtitle':
      'Without a valid session, nothing can dispatch. This page is where you sign the account in and confirm the worker can see it.',
    'session.active.title': 'Session is active',
    'session.invalid.title': 'Session invalid',
    'session.active.desc':
      'The worker can reach your Facebook account. Campaigns will dispatch on schedule.',
    'session.invalid.desc':
      'The worker cannot see your account. Run the two steps below to reconnect.',
    'session.badge.ready': 'ready',
    'session.badge.actionReq': 'action required',
    'session.badge.browser': 'browser step',
    'session.badge.verify': 'verify',
    'session.checked': 'checked',
    'session.step01.title': 'Open the login window',
    'session.step01.desc':
      "The worker will launch a Chrome window on your machine. Sign in to Facebook — including any 2FA prompt — and then close the window when you're done.",
    'session.step01.cta': 'Open browser to log in',
    'session.step01.loading': 'Opening…',
    'session.step02.title': 'Confirm the session',
    'session.step02.desc':
      'After closing the login window, run the verification. The worker will check it can reach Facebook as you and save the result.',
    'session.step02.cta': 'Verify session',
    'session.step02.loading': 'Verifying…',
    'session.why.head': 'Why a real browser?',
    'session.why.body':
      "Facebook's anti-bot checks are strict on headless automation. Signing in through a normal Chrome window — with your normal habits — is what keeps the session quietly trusted.",

    'confirm.session.setup.eyebrow': 'Step 01',
    'confirm.session.setup.title': 'Open browser to log into Facebook?',
    'confirm.session.setup.desc':
      'Worker will open a Chrome window. Sign in as usual, then close the window.',
    'confirm.session.setup.cta': 'Open browser',
    'toast.session.setup.ok': 'Browser opened',
    'toast.session.setup.ok.desc': 'Please sign in on the window that appeared.',
    'toast.session.setup.fail': 'Failed to open browser',

    'confirm.session.verify.eyebrow': 'Step 02',
    'confirm.session.verify.title': 'Verify session?',
    'confirm.session.verify.desc':
      'Worker will check whether it can reach Facebook as your account.',
    'confirm.session.verify.cta': 'Verify',
    'toast.session.verify.ok': 'Session is working',
    'toast.session.verify.ok.desc':
      'Worker can reach Facebook as your account.',
    'toast.session.verify.fail': 'Session not ready',
    'toast.session.verify.fail.desc': 'Please try signing in again.',

    /* ---------- Locale ---------- */
    'locale.en': 'EN',
    'locale.th': 'TH',
  },

  th: {
    /* ---------- Common ---------- */
    'common.loading': 'กำลังโหลด…',
    'common.confirm': 'ตกลง',
    'common.cancel': 'ยกเลิก',
    'common.save': 'บันทึก',
    'common.remove': 'ลบ',
    'common.dash': '—',
    'common.never': 'ยังไม่เคย',
    'common.none': 'ไม่มี',

    /* ---------- Brand / shell ---------- */
    'brand.name': 'Atelier',
    'brand.tagline': 'ตัวช่วยโพสต์กลุ่ม',
    'shell.footer.a': 'โพสต์ทุกชิ้นอย่างตั้งใจ',
    'shell.footer.b': 'ไม่ใช่แค่ยิง ๆ ไป',
    'shell.appearance': 'ธีม',
    'shell.language': 'ภาษา',
    'shell.session.eyebrow': 'Facebook',
    'shell.session.active': 'เชื่อมต่อแล้ว',
    'shell.session.invalid': 'ต้องล็อกอินใหม่',

    /* ---------- Nav ---------- */
    'nav.dashboard': 'หน้าแรก',
    'nav.dashboard.hint': 'ดูภาพรวมของวันนี้',
    'nav.campaigns': 'แคมเปญ',
    'nav.campaigns.hint': 'ที่ตั้งเวลาและร่างไว้',
    'nav.groups': 'กลุ่ม',
    'nav.groups.hint': 'กลุ่มปลายทาง',
    'nav.activity': 'ประวัติ',
    'nav.activity.hint': 'ดูว่าโพสต์อะไรไปแล้วบ้าง',
    'nav.settings': 'ตั้งค่า',
    'nav.settings.hint': 'ความเร็ว ความปลอดภัย',
    'nav.session': 'เซสชัน',
    'nav.session.hint': 'บัญชี Facebook',

    /* ---------- Session banner ---------- */
    'banner.title': 'ต้องล็อกอิน Facebook ใหม่',
    'banner.desc':
      'ตอนนี้ระบบโพสต์ให้ไม่ได้ จนกว่าจะล็อกอินใหม่อีกครั้ง แคมเปญที่ตั้งเวลาไว้จะยังไม่ถูกส่งออก',
    'banner.cta': 'ล็อกอินใหม่',

    /* ---------- Dashboard ---------- */
    'dash.greet.late': 'ยังไม่นอนเลยเหรอ',
    'dash.greet.morning': 'อรุณสวัสดิ์',
    'dash.greet.afternoon': 'สวัสดีตอนบ่าย',
    'dash.greet.evening': 'สวัสดีตอนเย็น',
    'dash.greet.night': 'ดึกแล้วนะ',
    'dash.hero.line1': 'ระบบ',
    'dash.hero.warm': 'พร้อมแล้ว',
    'dash.hero.line2': 'วันนี้จะโพสต์อะไรดี?',
    'dash.hero.subtitle':
      'ตั้งแคมเปญใหม่ ดูผลของเมื่อวาน แล้วโพสต์ให้สม่ำเสมอ',
    'dash.compose': 'เขียนโพสต์ใหม่',
    'dash.vital.session': 'เซสชัน',
    'dash.vital.session.active': 'ใช้ได้',
    'dash.vital.session.invalid': 'ใช้ไม่ได้',
    'dash.vital.session.helper.valid': 'เชื่อม Facebook ไว้แล้ว',
    'dash.vital.session.helper.invalid': 'ต้องล็อกอินใหม่',
    'dash.vital.inflight': 'กำลังโพสต์',
    'dash.vital.inflight.none': 'ยังไม่มีแคมเปญทำงานอยู่',
    'dash.vital.paused': 'พักไว้',
    'dash.vital.paused.clear': 'คิวว่าง',
    'dash.vital.paused.waiting': 'รอกดปลดพัก',
    'dash.vital.delivery': 'ส่งสำเร็จใน 7 วัน',
    'dash.vital.delivered': 'สำเร็จ {n}',
    'dash.vital.failed': 'พลาด {n}',
    'dash.vital.live': 'กำลังโพสต์',
    'dash.upcoming.eyebrow': '7 วันข้างหน้า',
    'dash.upcoming.title': 'แคมเปญที่กำลังจะถึง',
    'dash.upcoming.viewAll': 'ดูทั้งหมด →',
    'dash.upcoming.empty.title': 'ยังไม่มีแคมเปญตั้งเวลาไว้',
    'dash.upcoming.empty.desc':
      'ช่วงนี้คิวว่าง เป็นเวลาดีที่จะเขียนโพสต์ใหม่ไว้รอส่ง',
    'dash.upcoming.empty.cta': 'เขียนโพสต์ใหม่',
    'dash.upcoming.via': 'ส่งอัตโนมัติ',
    'dash.upcoming.scheduled': 'ตั้งเวลาไว้',
    'dash.pulse.eyebrow': '7 วันที่ผ่านมา',
    'dash.pulse.title': 'สรุปกิจกรรม',
    'dash.pulse.delivered': 'ส่งสำเร็จ',
    'dash.pulse.failed': 'พลาด / ข้าม',
    'dash.pulse.successRate': 'อัตราสำเร็จ',
    'dash.shortcuts.eyebrow': 'ทางลัด',
    'dash.shortcuts.title': 'ลัดไปที่',
    'dash.shortcuts.new': 'เขียนโพสต์ใหม่',
    'dash.shortcuts.new.hint': 'ตั้งเวลาหรือส่งเลย',
    'dash.shortcuts.groups': 'จัดการกลุ่ม',
    'dash.shortcuts.groups.hint': 'เพิ่ม เปิด/ปิด หรือ sync',
    'dash.shortcuts.logs': 'ดูประวัติ',
    'dash.shortcuts.logs.hint': '200 รายการล่าสุด',
    'dash.shortcuts.settings': 'ปรับความเร็ว',
    'dash.shortcuts.settings.hint': 'หน่วงเวลา, jitter, retry',

    /* ---------- Campaigns list ---------- */
    'camps.eyebrow': 'แคมเปญ',
    'camps.title': 'แคมเปญทั้งหมด',
    'camps.subtitle':
      'ทั้งที่ตั้งเวลาไว้ กำลังส่ง พักไว้ หรือเสร็จแล้ว ดูได้ที่นี่ทุกอัน',
    'camps.new': 'แคมเปญใหม่',
    'camps.th.title': 'หัวข้อ',
    'camps.th.status': 'สถานะ',
    'camps.th.scheduled': 'ตั้งเวลา',
    'camps.th.groups': 'กลุ่ม',
    'camps.empty.title': 'ยังไม่มีแคมเปญเลย',
    'camps.empty.desc':
      'เริ่มแคมเปญแรกกันเลย — เลือกเนื้อหา กลุ่มปลายทาง และเวลาที่จะส่ง',
    'camps.empty.cta': 'เริ่มแคมเปญแรก',

    /* ---------- Campaign detail ---------- */
    'camp.back': 'แคมเปญทั้งหมด',
    'camp.eyebrow': 'แคมเปญ',
    'camp.untitled': 'แคมเปญไม่มีหัวข้อ',
    'camp.scheduledFor': 'ตั้งเวลาส่งวันที่',
    'camp.at': 'เวลา',
    'camp.resume': 'ทำงานต่อ',
    'camp.cancel': 'ยกเลิก',
    'camp.lastError': 'ข้อผิดพลาดล่าสุด',
    'camp.content.eyebrow': 'เนื้อหา',
    'camp.content.title': 'ข้อความที่จะโพสต์',
    'camp.sent.eyebrow': '{n} กลุ่ม',
    'camp.sent.title': 'ส่งไปยัง',
    'camp.sent.empty': 'ยังไม่ได้เลือกกลุ่ม',
    'camp.log.eyebrow': '{n} รายการ',
    'camp.log.title': 'ประวัติการส่ง',
    'camp.log.empty':
      'ยังไม่ได้เริ่มส่ง ประวัติจะขึ้นมาเมื่อระบบเริ่มโพสต์',
    'camp.log.th.group': 'กลุ่ม',
    'camp.log.th.result': 'ผลลัพธ์',
    'camp.log.th.attempt': 'ครั้งที่',
    'camp.log.th.error': 'หมายเหตุ / ข้อผิดพลาด',
    'camp.log.th.completed': 'เสร็จเมื่อ',

    /* ---------- Campaign form ---------- */
    'form.eyebrow': 'สร้างใหม่',
    'form.title': 'แคมเปญใหม่',
    'form.subtitle':
      'ใส่ข้อความ ไฟล์แนบ เลือกกลุ่ม และตั้งเวลา — ที่เหลือให้ระบบจัดการให้',
    'form.step01': 'ขั้นที่ 01',
    'form.step02': 'ขั้นที่ 02',
    'form.step03': 'ขั้นที่ 03',
    'form.step04.eyebrow': 'ขั้นที่ 04 · กลุ่มปลายทาง',
    'form.section.message': 'ข้อความที่จะโพสต์',
    'form.section.attachments': 'ไฟล์แนบ',
    'form.section.timing': 'เวลา',
    'form.field.title': 'หัวข้อ',
    'form.field.title.hint': 'ใส่หรือไม่ใส่ก็ได้ · เอาไว้ดูในระบบ',
    'form.field.title.placeholder': 'เช่น โปรโมชันสุดสัปดาห์ · week 18',
    'form.field.content': 'เนื้อหา',
    'form.field.content.hint': '{n} ตัว',
    'form.field.content.placeholder':
      'พิมพ์โพสต์เหมือนที่จะขึ้นในแต่ละกลุ่ม ขึ้นบรรทัดใหม่ได้',
    'form.field.media': 'ประเภทไฟล์แนบ',
    'form.media.none': 'ไม่มี',
    'form.media.images': 'รูป (สูงสุด 10 รูป)',
    'form.media.video': 'วิดีโอ 1 ไฟล์',
    'form.field.upload': 'อัปโหลด',
    'form.upload.count': 'อัปโหลดไปแล้ว {n} ไฟล์',
    'form.upload.browse': 'ลากไฟล์มาวาง หรือคลิกเพื่อเลือก',
    'form.upload.chooseImages': 'คลิกเพื่อเลือกรูป',
    'form.upload.chooseVideo': 'คลิกเพื่อเลือกวิดีโอ',
    'form.field.dispatchAt': 'เวลาส่ง',
    'form.field.jitter': 'Jitter (± นาที)',
    'form.field.jitter.helper': 'สุ่มเวลานิดหน่อย ให้ดูเป็นธรรมชาติเหมือนคนโพสต์เอง',
    'form.field.recurrence': 'ส่งซ้ำ',
    'form.field.recurrence.helper':
      'Cron expression · เว้นว่างไว้ถ้าส่งครั้งเดียว',
    'form.dest.eyebrow': 'ขั้นที่ 04 · กลุ่มปลายทาง',
    'form.dest.title': 'กลุ่มที่จะส่ง',
    'form.dest.selectAll': 'เลือกทั้งหมด',
    'form.dest.clear': 'ล้าง',
    'form.dest.noActive.before': 'ยังไม่มีกลุ่มที่เปิดใช้งาน ไปเพิ่มกลุ่มที่หน้า ',
    'form.dest.noActive.link': 'กลุ่ม',
    'form.dest.noActive.after': ' ก่อนนะ',
    'form.submit': 'ตั้งเวลาส่ง',
    'form.submitting': 'กำลังตั้งเวลา…',
    'form.footer': 'จะมีแจ้งเตือนเมื่อระบบรับคิวเรียบร้อยแล้ว',

    /* Form confirm/toast */
    'form.toast.noGroups': 'ยังไม่ได้เลือกกลุ่ม',
    'form.toast.noGroups.desc': 'เลือกกลุ่มอย่างน้อย 1 กลุ่มก่อนนะ',
    'form.confirm.eyebrow': 'ยืนยันการส่ง',
    'form.confirm.title': 'ตั้งเวลาส่งเลยไหม?',
    'form.confirm.desc.to': 'จะส่งไปยัง',
    'form.confirm.desc.groups': 'กลุ่ม',
    'form.confirm.desc.on': 'วันที่',
    'form.confirm.desc.recurring': 'ส่งซ้ำตาม cron',
    'form.confirm.cta': 'ตั้งเวลาส่ง',
    'form.toast.success': 'ตั้งเวลาเรียบร้อย',
    'form.toast.success.desc': 'จะส่งไป {n} กลุ่ม · {when}',
    'form.toast.fail': 'ตั้งเวลาไม่สำเร็จ',

    /* Resume/cancel */
    'confirm.resume.eyebrow': 'ทำงานต่อ',
    'confirm.resume.title': 'ให้ทำงานต่อเลยไหม?',
    'confirm.resume.desc':
      'แคมเปญจะปลดพัก แล้วส่งต่อจากตรงที่ค้างไว้',
    'confirm.resume.cta': 'ทำงานต่อ',
    'toast.resume.ok': 'ปลดพักแล้ว',
    'toast.resume.ok.desc': 'แคมเปญจะทำงานต่อเลย',
    'toast.resume.fail': 'ปลดพักไม่สำเร็จ',

    'confirm.cancel.eyebrow': 'ยกเลิก',
    'confirm.cancel.title': 'ยกเลิกแคมเปญนี้เลยไหม?',
    'confirm.cancel.desc':
      'ยกเลิกแล้วแคมเปญนี้จะไม่ถูกส่งอีก และกลับมาทำต่อไม่ได้นะ',
    'confirm.cancel.cta': 'ยกเลิกแคมเปญ',
    'confirm.cancel.keep': 'เก็บไว้ก่อน',
    'toast.cancel.ok': 'ยกเลิกแล้ว',
    'toast.cancel.fail': 'ยกเลิกไม่สำเร็จ',

    /* ---------- Groups ---------- */
    'groups.eyebrow': 'กลุ่มปลายทาง',
    'groups.title': 'กลุ่มที่จะโพสต์ลง',
    'groups.subtitle':
      'จัดการรายชื่อกลุ่ม Facebook ของคุณ เปิดใช้งานกลุ่มที่อยากโพสต์ หรือพักกลุ่มที่ยังไม่อยากโพสต์ตอนนี้ไว้ก่อน',
    'groups.autosync': 'ดึงจาก Facebook อัตโนมัติ',
    'groups.add.eyebrow': 'เพิ่มจากลิงก์',
    'groups.add.title': 'วางลิงก์กลุ่มที่นี่',
    'groups.add.detected': 'เจอ {n} ลิงก์',
    'groups.add.helper':
      'หนึ่งลิงก์ต่อหนึ่งบรรทัด · รองรับ facebook.com/groups/…',
    'groups.add.button': 'เพิ่ม {n} กลุ่ม',
    'groups.add.button.plural': 'เพิ่ม {n} กลุ่ม',
    'groups.add.button.empty': 'เพิ่มกลุ่ม',
    'groups.add.adding': 'กำลังเพิ่ม…',
    'groups.summary.eyebrow': 'สรุป',
    'groups.summary.title': 'รายชื่อกลุ่ม',
    'groups.summary.active': 'เปิดใช้งาน',
    'groups.summary.active.helper': 'พร้อมรับแคมเปญถัดไป',
    'groups.summary.total': 'ทั้งหมด',
    'groups.summary.total.helper': 'ในรายชื่อ',
    'groups.roster.eyebrow': '{n} กลุ่ม',
    'groups.roster.title': 'รายชื่อกลุ่มทั้งหมด',
    'groups.roster.empty.title': 'ยังไม่มีกลุ่มเลย',
    'groups.roster.empty.desc':
      'วางลิงก์กลุ่มด้านบน หรือกดปุ่ม sync เพื่อดึงรายชื่อกลุ่มที่คุณเป็นสมาชิกมาอัตโนมัติ',
    'groups.th.status': 'สถานะ',
    'groups.th.group': 'กลุ่ม',
    'groups.th.url': 'ลิงก์',
    'groups.th.capability': 'ความสามารถ',
    'groups.th.lastPosted': 'โพสต์ล่าสุด',

    /* Group confirm/toast */
    'confirm.groups.add.eyebrow': 'เพิ่มกลุ่ม',
    'confirm.groups.add.title': 'เพิ่ม {n} กลุ่มนี้เข้าระบบ?',
    'confirm.groups.add.desc':
      'ถ้ามีลิงก์ที่ซ้ำกัน ระบบจะข้ามให้อัตโนมัติ',
    'confirm.groups.add.cta': 'เพิ่มเลย',
    'toast.groups.add.ok': 'เพิ่มกลุ่มเรียบร้อย',
    'toast.groups.add.desc': 'เพิ่ม {c} · ข้าม {s}',
    'toast.groups.add.fail': 'เพิ่มกลุ่มไม่สำเร็จ',

    'confirm.groups.sync.eyebrow': 'Sync อัตโนมัติ',
    'confirm.groups.sync.title': 'ให้ระบบเปิดเบราว์เซอร์ไปดูกลุ่มให้ไหม?',
    'confirm.groups.sync.desc':
      'ระบบจะเปิดหน้าต่าง Chrome ไปดูว่าคุณเป็นสมาชิกกลุ่มไหนบ้าง ใช้เวลาสักครู่นะ',
    'confirm.groups.sync.cta': 'เริ่มเลย',
    'toast.groups.sync.ok': 'เริ่มดึงข้อมูลแล้ว',
    'toast.groups.sync.ok.desc':
      'ระบบกำลังเปิดเบราว์เซอร์ รอสักครู่แล้วกด Refresh',
    'toast.groups.sync.fail': 'เริ่มไม่สำเร็จ',

    'confirm.groups.remove.eyebrow': 'ลบกลุ่ม',
    'confirm.groups.remove.title': 'ลบกลุ่ม "{name}" ?',
    'confirm.groups.remove.desc':
      'กลุ่มนี้จะหายไปจากรายชื่อ แคมเปญต่อไปจะไม่ส่งเข้ากลุ่มนี้อีก',
    'confirm.groups.remove.cta': 'ลบออก',
    'confirm.groups.remove.keep': 'เก็บไว้',
    'toast.groups.remove.ok': 'ลบเรียบร้อย',
    'toast.groups.remove.fail': 'ลบกลุ่มไม่สำเร็จ',

    'toast.groups.enable.ok': 'เปิดใช้งานแล้ว',
    'toast.groups.disable.ok': 'พักกลุ่มนี้แล้ว',
    'toast.groups.toggle.fail': 'เปลี่ยนสถานะไม่สำเร็จ',

    'groups.action.scanCapabilities': 'สแกนความสามารถประกาศขาย',
    'groups.action.scanCapabilities.alert': 'Worker จะเปิดเบราว์เซอร์และสแกนแต่ละกลุ่ม — ใช้เวลา ~5-10 วินาทีต่อกลุ่ม รีเฟรชหน้านี้หลังเสร็จ',
    'groups.badge.listingOk': 'ประกาศขาย',
    'groups.badge.listingNo': 'ข้อความเท่านั้น',
    'groups.badge.notScanned': 'ยังไม่สแกน',

    'confirm.groups.scan.eyebrow': 'สแกนความสามารถ',
    'confirm.groups.scan.title': 'สแกนความสามารถประกาศขาย?',
    'confirm.groups.scan.desc': 'Worker จะเปิดเบราว์เซอร์และสแกนแต่ละกลุ่ม — ใช้เวลา ~5-10 วินาทีต่อกลุ่ม รีเฟรชหน้านี้หลังเสร็จ',
    'confirm.groups.scan.cta': 'เริ่มสแกน',
    'toast.groups.scan.ok': 'เริ่มสแกนแล้ว',
    'toast.groups.scan.ok.desc': 'Worker กำลังสแกนกลุ่ม รอสักครู่แล้วกด Refresh',
    'toast.groups.scan.fail': 'เริ่มสแกนไม่สำเร็จ',

    /* ---------- Logs ---------- */
    'logs.eyebrow': 'กิจกรรม',
    'logs.title': 'ประวัติการส่งทั้งหมด',
    'logs.subtitle':
      '200 รายการล่าสุด เรียงจากใหม่ไปเก่า — ทั้งสำเร็จ พลาด และ retry เห็นหมด',
    'logs.empty.title': 'ยังไม่มีรายการ',
    'logs.empty.desc':
      'พอเริ่มส่งแคมเปญแรกแล้ว ทุกการโพสต์จะถูกบันทึกไว้ที่นี่',
    'logs.th.when': 'เวลา',
    'logs.th.campaign': 'แคมเปญ',
    'logs.th.group': 'กลุ่ม',
    'logs.th.result': 'ผลลัพธ์',
    'logs.th.attempt': 'ครั้งที่',
    'logs.th.error': 'ข้อผิดพลาด',

    /* ---------- Settings ---------- */
    'settings.eyebrow': 'ความเร็วและความปลอดภัย',
    'settings.title': 'ตั้งค่าการส่ง',
    'settings.subtitle':
      'หน่วงเวลา, retry, และ jitter ให้เหมือนคนโพสต์จริง — เพิ่มค่าเพื่อปลอดภัยขึ้น ลดค่าเฉพาะตอนที่แน่ใจเท่านั้น',
    'settings.save': 'บันทึก',
    'settings.saving': 'กำลังบันทึก…',
    'settings.timing.eyebrow': 'เวลา',
    'settings.timing.title': 'หน่วงเวลา (มิลลิวินาที)',
    'settings.pair.min': 'ต่ำสุด',
    'settings.pair.max': 'สูงสุด',
    'settings.pair.ms': 'ms',
    'settings.delay.groups': 'หน่วงเวลาระหว่างกลุ่ม',
    'settings.delay.groups.hint': 'พักกี่มิลลิวินาทีก่อนโพสต์กลุ่มถัดไป',
    'settings.delay.post': 'หน่วงก่อนกดโพสต์',
    'settings.delay.post.hint': 'หลังพิมพ์เสร็จแล้วรอกี่วินาทีก่อนกดปุ่ม Post',
    'settings.delay.focus': 'หน่วงหลังเปิดช่องพิมพ์',
    'settings.delay.focus.hint': 'รอกี่วินาทีหลังช่องพิมพ์เปิดขึ้นมา',
    'settings.delay.retry': 'หน่วงก่อนลองใหม่',
    'settings.delay.retry.hint': 'พอส่งพลาดแล้วรอกี่วินาทีก่อนลองอีก',
    'settings.listing.delay': 'ประกาศขาย: หน่วงเวลาระหว่างชุด',
    'settings.listing.delay.hint': 'พักระหว่างการส่งชุดไปยังประกาศขาย',
    'settings.retry.eyebrow': 'ลองใหม่',
    'settings.retry.title': 'ถ้าส่งไม่สำเร็จ',
    'settings.retry.max': 'ลองใหม่ได้สูงสุดกี่ครั้งต่อกลุ่ม',
    'settings.retry.max.hint':
      'ลองกี่ครั้งก่อนจะข้ามกลุ่มนั้นไป',
    'settings.retry.stop': 'หยุดถ้าพลาดติดกัน',
    'settings.retry.stop.hint':
      'ตัวกันเหนียว — พักแคมเปญทั้งหมดถ้าพลาดติดกันหลายครั้งรวด',
    'settings.behaviour.eyebrow': 'พฤติกรรม',
    'settings.behaviour.title': 'ทำให้เหมือนคนโพสต์เอง',
    'settings.toggle.mouse': 'ขยับเมาส์เป็นเส้นโค้ง',
    'settings.toggle.mouse.hint':
      'ให้เมาส์เคลื่อนที่แบบคนจริง ไม่ใช่กระโดดเป็นเส้นตรง',
    'settings.toggle.scroll': 'เลื่อนฟีดก่อนโพสต์',
    'settings.toggle.scroll.hint':
      'เลื่อนฟีดกลุ่มนิดนึงก่อนเปิดช่องพิมพ์',
    'settings.toggle.jitter': 'สุ่มเวลาส่ง',
    'settings.toggle.jitter.hint':
      'เหลื่อมเวลาโพสต์ตามค่า jitter ที่ตั้งไว้ในแต่ละแคมเปญ',
    'settings.listing.eyebrow': 'ประกาศขาย',
    'settings.listing.title': 'ควบคุมชุด',
    'settings.listing.maxbatches': 'จำนวนชุดสูงสุดต่อวัน',
    'settings.listing.maxbatches.hint': 'เตือน — จะแจ้งถ้าเกินจำนวนชุดต่อวันที่ตั้งไว้',

    'confirm.settings.eyebrow': 'บันทึกการตั้งค่า',
    'confirm.settings.title': 'บันทึกการตั้งค่าใหม่?',
    'confirm.settings.desc':
      'การตั้งค่าใหม่จะมีผลกับแคมเปญที่ยังไม่ได้ส่งออก',
    'confirm.settings.cta': 'บันทึก',
    'toast.settings.ok': 'บันทึกเรียบร้อย',
    'toast.settings.ok.desc': 'มีผลทันทีเลย',
    'toast.settings.fail': 'บันทึกไม่สำเร็จ',

    /* ---------- Session ---------- */
    'session.eyebrow': 'บัญชี',
    'session.title': 'เซสชัน Facebook',
    'session.subtitle':
      'ถ้าเซสชันใช้ไม่ได้ ระบบจะโพสต์ไม่ได้เลย หน้านี้เอาไว้ล็อกอิน Facebook และตรวจว่าระบบเข้าถึงบัญชีคุณได้',
    'session.active.title': 'เซสชันใช้ได้',
    'session.invalid.title': 'เซสชันใช้ไม่ได้',
    'session.active.desc':
      'ระบบเข้าถึง Facebook ของคุณได้ แคมเปญจะส่งตามเวลาที่ตั้งไว้',
    'session.invalid.desc':
      'ระบบเข้าถึงบัญชีไม่ได้ ทำตาม 2 ขั้นตอนด้านล่างเพื่อเชื่อมต่อใหม่',
    'session.badge.ready': 'พร้อม',
    'session.badge.actionReq': 'ต้องทำอะไรสักอย่าง',
    'session.badge.browser': 'เปิดเบราว์เซอร์',
    'session.badge.verify': 'ตรวจสอบ',
    'session.checked': 'ตรวจเมื่อ',
    'session.step01.title': 'เปิดหน้าต่างล็อกอิน',
    'session.step01.desc':
      'ระบบจะเปิดหน้าต่าง Chrome ล็อกอิน Facebook ตามปกติ (ถ้ามี 2FA ก็ใส่ไปเลย) พอเสร็จแล้วปิดหน้าต่างได้',
    'session.step01.cta': 'เปิดเบราว์เซอร์',
    'session.step01.loading': 'กำลังเปิด…',
    'session.step02.title': 'ตรวจสอบเซสชัน',
    'session.step02.desc':
      'พอปิดหน้าต่างล็อกอินแล้ว กดตรวจสอบเพื่อให้ระบบยืนยันว่าเข้าถึงบัญชีของคุณได้',
    'session.step02.cta': 'ตรวจสอบ',
    'session.step02.loading': 'กำลังตรวจสอบ…',
    'session.why.head': 'ทำไมต้องเปิดเบราว์เซอร์จริง?',
    'session.why.body':
      'Facebook ตรวจจับบอทค่อนข้างเข้ม ถ้าล็อกอินผ่าน Chrome จริง ๆ เหมือนที่ใช้ประจำ ระบบจะดูน่าเชื่อถือกว่า',

    'confirm.session.setup.eyebrow': 'ขั้นที่ 01',
    'confirm.session.setup.title': 'เปิดเบราว์เซอร์ล็อกอิน Facebook เลยไหม?',
    'confirm.session.setup.desc':
      'ระบบจะเปิดหน้าต่าง Chrome ล็อกอินตามปกติ แล้วปิดหน้าต่างเมื่อเสร็จ',
    'confirm.session.setup.cta': 'เปิดเลย',
    'toast.session.setup.ok': 'เปิดเบราว์เซอร์ให้แล้ว',
    'toast.session.setup.ok.desc':
      'ล็อกอินในหน้าต่างที่เปิดขึ้นมาได้เลย',
    'toast.session.setup.fail': 'เปิดเบราว์เซอร์ไม่ได้',

    'confirm.session.verify.eyebrow': 'ขั้นที่ 02',
    'confirm.session.verify.title': 'ตรวจสอบเซสชันเลยไหม?',
    'confirm.session.verify.desc':
      'ระบบจะลองเข้าถึง Facebook ในฐานะบัญชีของคุณดู',
    'confirm.session.verify.cta': 'ตรวจสอบ',
    'toast.session.verify.ok': 'ใช้งานได้ปกติ',
    'toast.session.verify.ok.desc':
      'ระบบเข้าถึง Facebook ในฐานะบัญชีคุณได้แล้ว',
    'toast.session.verify.fail': 'ยังใช้ไม่ได้',
    'toast.session.verify.fail.desc': 'ลองล็อกอินใหม่อีกครั้งนะ',

    /* ---------- Locale ---------- */
    'locale.en': 'EN',
    'locale.th': 'TH',
  },
} as const;

export type TranslationKey = keyof typeof DICT.en;

/* ================================================================== */

type LocaleAPI = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleAPI | null>(null);

function interpolate(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(vars[key] ?? `{${key}}`),
  );
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('th');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (typeof localStorage !== 'undefined' && localStorage.getItem('locale')) as Locale | null;
    if (stored === 'en' || stored === 'th') {
      setLocaleState(stored);
    } else {
      const nav = typeof navigator !== 'undefined' ? navigator.language : 'th';
      setLocaleState(nav.toLowerCase().startsWith('th') ? 'th' : 'en');
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale, mounted]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem('locale', l);
    } catch {
      /* noop */
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      const table = DICT[locale] ?? DICT.en;
      const raw = table[key] ?? DICT.en[key] ?? key;
      return interpolate(raw, vars);
    },
    [locale],
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be inside <LocaleProvider>');
  return ctx;
}

export function useT() {
  return useLocale().t;
}
