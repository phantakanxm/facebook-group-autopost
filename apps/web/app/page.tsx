'use client';
import { trpc } from '@/lib/trpc-client';
import Link from 'next/link';
import { PageHeader, Surface, SectionHeader, EmptyState } from '@/components/ui/section';
import { StatusPill } from '@/components/ui/status-pill';
import { Button } from '@/components/ui/button';
import { useT, useLocale, type TranslationKey } from '@/lib/i18n';
import { cn } from '@/lib/cn';

function greetingKey(): TranslationKey {
  const h = new Date().getHours();
  if (h < 5) return 'dash.greet.late';
  if (h < 12) return 'dash.greet.morning';
  if (h < 17) return 'dash.greet.afternoon';
  if (h < 21) return 'dash.greet.evening';
  return 'dash.greet.night';
}

function formatDateParts(d: Date, locale: string) {
  const loc = locale === 'th' ? 'th-TH' : 'en-GB';
  const day = d.toLocaleDateString(loc, { day: '2-digit' });
  const month = d.toLocaleDateString(loc, { month: 'short' }).toUpperCase();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  return { day, month, time };
}

export default function DashboardPage() {
  const s = trpc.dashboard.summary.useQuery();
  const t = useT();
  const { locale } = useLocale();
  const loc = locale === 'th' ? 'th-TH' : 'en-GB';

  return (
    <div className="space-y-12 animate-rise">
      <PageHeader
        eyebrow={`${t(greetingKey())} · ${new Date().toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' })}`}
        title={
          <>
            {t('dash.hero.line1')}{' '}
            <em className="not-italic text-[var(--accent)]">{t('dash.hero.warm')}</em>.
            <br />
            {t('dash.hero.line2')}
          </>
        }
        subtitle={t('dash.hero.subtitle')}
        actions={
          <Link href="/campaigns/new">
            <Button size="md">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              {t('dash.compose')}
            </Button>
          </Link>
        }
      />

      {!s.data ? (
        <Surface><p className="text-ink-muted">{t('common.loading')}</p></Surface>
      ) : (
        <>
          {/* ---------- Vital signs ---------- */}
          <section className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <VitalSign
              label={t('dash.vital.session')}
              value={s.data.session.valid ? t('dash.vital.session.active') : t('dash.vital.session.invalid')}
              helper={s.data.session.valid ? t('dash.vital.session.helper.valid') : t('dash.vital.session.helper.invalid')}
              tone={s.data.session.valid ? 'positive' : 'danger'}
              toneLabel={s.data.session.valid ? 'positive' : 'danger'}
              className="animate-rise animate-rise-1"
            />
            <VitalSign
              label={t('dash.vital.inflight')}
              value={s.data.running ? 1 : 0}
              helper={
                s.data.running ? (
                  <Link href={`/campaigns/${s.data.running.id}`} className="underline-offset-4 hover:underline">
                    {s.data.running.title ?? s.data.running.id.slice(0, 6)}
                  </Link>
                ) : (
                  t('dash.vital.inflight.none')
                )
              }
              tone={s.data.running ? 'accent' : 'neutral'}
              toneLabel={t('dash.vital.live')}
              className="animate-rise animate-rise-2"
            />
            <VitalSign
              label={t('dash.vital.paused')}
              value={s.data.pausedCount}
              helper={s.data.pausedCount === 0 ? t('dash.vital.paused.clear') : t('dash.vital.paused.waiting')}
              tone={s.data.pausedCount > 0 ? 'caution' : 'neutral'}
              toneLabel="caution"
              className="animate-rise animate-rise-3"
            />
            <VitalSign
              label={t('dash.vital.delivery')}
              value={
                s.data.recent.successRate === null
                  ? '—'
                  : `${(s.data.recent.successRate * 100).toFixed(0)}%`
              }
              helper={
                <>
                  {t('dash.vital.delivered', { n: s.data.recent.success })} ·{' '}
                  {t('dash.vital.failed', { n: s.data.recent.failed })}
                </>
              }
              tone="neutral"
              toneLabel=""
              className="animate-rise animate-rise-4"
            />
          </section>

          {/* ---------- Upcoming dispatches ---------- */}
          <section>
            <SectionHeader
              eyebrow={t('dash.upcoming.eyebrow')}
              title={t('dash.upcoming.title')}
              actions={
                <Link href="/campaigns">
                  <Button variant="ghost" size="sm">{t('dash.upcoming.viewAll')}</Button>
                </Link>
              }
            />

            {s.data.upcoming.length === 0 ? (
              <Surface padded={false} className="px-6">
                <EmptyState
                  title={t('dash.upcoming.empty.title')}
                  description={t('dash.upcoming.empty.desc')}
                  action={
                    <Link href="/campaigns/new">
                      <Button variant="outline" size="sm">{t('dash.upcoming.empty.cta')}</Button>
                    </Link>
                  }
                />
              </Surface>
            ) : (
              <Surface padded={false}>
                <ul className="divide-y divide-line">
                  {s.data.upcoming.map((c, i) => {
                    const parts = formatDateParts(new Date(c.scheduledAt), locale);
                    return (
                      <li key={c.id} className={cn('animate-rise', `animate-rise-${Math.min(i + 1, 4)}`)}>
                        <Link
                          href={`/campaigns/${c.id}`}
                          className="group flex items-center gap-6 px-6 py-5 transition-colors hover:bg-surface"
                        >
                          <div className="flex flex-col items-center text-center w-14 shrink-0">
                            <span className="font-display text-[28px] leading-none text-ink tnum">{parts.day}</span>
                            <span className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink-faint">{parts.month}</span>
                          </div>

                          <div className="h-10 w-px bg-line" />

                          <div className="flex flex-1 flex-col gap-1 min-w-0">
                            <div className="flex items-center gap-3">
                              <span className="truncate font-medium text-ink">
                                {c.title ?? c.id.slice(0, 6)}
                              </span>
                              <StatusPill tone="neutral" dot>{t('dash.upcoming.scheduled')}</StatusPill>
                            </div>
                            <div className="flex items-center gap-3 text-2xs text-ink-faint">
                              <span className="tnum">{parts.time}</span>
                              <span>·</span>
                              <span>{t('dash.upcoming.via')}</span>
                            </div>
                          </div>

                          <svg
                            className="text-ink-faint transition-transform duration-200 ease-out-quart group-hover:translate-x-0.5 group-hover:text-[var(--accent)]"
                            width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden
                          >
                            <path d="M5 3l5 5-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Surface>
            )}
          </section>

          {/* ---------- Activity pulse ---------- */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <Surface className="lg:col-span-3">
              <SectionHeader eyebrow={t('dash.pulse.eyebrow')} title={t('dash.pulse.title')} />
              <div className="grid grid-cols-3 gap-6 pt-3">
                <PulseStat
                  label={t('dash.pulse.delivered')}
                  value={s.data.recent.success}
                  tone="positive"
                />
                <PulseStat
                  label={t('dash.pulse.failed')}
                  value={s.data.recent.failed}
                  tone={s.data.recent.failed > 0 ? 'danger' : 'neutral'}
                />
                <PulseStat
                  label={t('dash.pulse.successRate')}
                  value={
                    s.data.recent.successRate === null
                      ? '—'
                      : `${(s.data.recent.successRate * 100).toFixed(1)}%`
                  }
                  tone="neutral"
                />
              </div>
            </Surface>

            <Surface className="lg:col-span-2">
              <SectionHeader eyebrow={t('dash.shortcuts.eyebrow')} title={t('dash.shortcuts.title')} />
              <nav className="flex flex-col gap-1 pt-2">
                <ShortcutLink href="/campaigns/new" label={t('dash.shortcuts.new')} hint={t('dash.shortcuts.new.hint')} />
                <ShortcutLink href="/groups" label={t('dash.shortcuts.groups')} hint={t('dash.shortcuts.groups.hint')} />
                <ShortcutLink href="/logs" label={t('dash.shortcuts.logs')} hint={t('dash.shortcuts.logs.hint')} />
                <ShortcutLink href="/settings" label={t('dash.shortcuts.settings')} hint={t('dash.shortcuts.settings.hint')} />
              </nav>
            </Surface>
          </section>
        </>
      )}
    </div>
  );
}

function VitalSign({
  label,
  value,
  helper,
  tone,
  toneLabel,
  className,
}: {
  label: React.ReactNode;
  value: string | number;
  helper: React.ReactNode;
  tone: 'positive' | 'danger' | 'caution' | 'accent' | 'neutral';
  toneLabel: string;
  className?: string;
}) {
  const toneClass =
    tone === 'accent'
      ? 'text-[var(--accent)]'
      : tone === 'positive'
        ? 'text-[var(--positive)]'
        : tone === 'danger'
          ? 'text-[var(--danger)]'
          : tone === 'caution'
            ? 'text-[var(--caution)]'
            : 'text-ink';

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <div className="flex items-center justify-between">
        <span className="small-caps">{label}</span>
        {tone !== 'neutral' && toneLabel && (
          <StatusPill tone={tone} dot pulse={tone === 'accent'}>
            {toneLabel}
          </StatusPill>
        )}
      </div>
      <div className="rule" />
      <div className={cn('editorial-num text-[clamp(2.5rem,2vw+1.8rem,3.25rem)] leading-[0.95]', toneClass)}>
        {value}
      </div>
      <div className="text-sm text-ink-muted">{helper}</div>
    </div>
  );
}

function PulseStat({
  label,
  value,
  tone,
}: {
  label: React.ReactNode;
  value: string | number;
  tone: 'positive' | 'danger' | 'neutral';
}) {
  const color =
    tone === 'positive'
      ? 'text-[var(--positive)]'
      : tone === 'danger'
        ? 'text-[var(--danger)]'
        : 'text-ink';
  return (
    <div className="flex flex-col gap-2">
      <span className="small-caps">{label}</span>
      <span className={cn('editorial-num text-[2.1rem] leading-none tnum', color)}>{value}</span>
    </div>
  );
}

function ShortcutLink({
  href,
  label,
  hint,
}: {
  href: string;
  label: React.ReactNode;
  hint: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group -mx-3 flex items-center justify-between rounded-md px-3 py-2.5 transition-colors hover:bg-surface"
    >
      <span className="flex flex-col">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className="text-2xs text-ink-faint">{hint}</span>
      </span>
      <svg
        className="text-ink-faint transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--accent)]"
        width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden
      >
        <path d="M4 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
