'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import { trpc } from '@/lib/trpc-client';
import { PageHeader, Surface, SectionHeader, Divider } from '@/components/ui/section';
import { CampaignStatus, StatusPill } from '@/components/ui/status-pill';
import { Button } from '@/components/ui/button';
import { Table, THead, TH, TRow, TD } from '@/components/ui/table';
import { useConfirm, useToast, useLoading } from '@/components/ui/feedback';
import { useT, useLocale, type TranslationKey } from '@/lib/i18n';
import { cn } from '@/lib/cn';

type LocaleString = 'th-TH' | 'en-GB';

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const t = useT();
  const { locale } = useLocale();
  const loc: LocaleString = locale === 'th' ? 'th-TH' : 'en-GB';

  const c = trpc.campaign.get.useQuery({ id }, { refetchInterval: 5000 });
  const resume = trpc.campaign.resume.useMutation({ onSuccess: () => c.refetch() });
  const cancel = trpc.campaign.cancel.useMutation({ onSuccess: () => c.refetch() });

  const confirm = useConfirm();
  const toast = useToast();
  const loading = useLoading();

  const handleResume = async () => {
    const ok = await confirm({
      eyebrow: t('confirm.resume.eyebrow'),
      title: t('confirm.resume.title'),
      description: t('confirm.resume.desc'),
      confirmLabel: t('confirm.resume.cta'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    try {
      await loading.wrap(t('common.working.resume'), () => resume.mutateAsync({ id }));
      toast.success(t('toast.resume.ok'), t('toast.resume.ok.desc'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      toast.error(t('toast.resume.fail'), msg);
    }
  };

  const handleCancel = async (isRunning: boolean) => {
    const ok = await confirm({
      eyebrow: isRunning ? t('confirm.cancelRunning.eyebrow') : t('confirm.cancel.eyebrow'),
      title: isRunning ? t('confirm.cancelRunning.title') : t('confirm.cancel.title'),
      description: isRunning ? t('confirm.cancelRunning.desc') : t('confirm.cancel.desc'),
      confirmLabel: isRunning ? t('confirm.cancelRunning.cta') : t('confirm.cancel.cta'),
      cancelLabel: isRunning ? t('confirm.cancelRunning.keep') : t('confirm.cancel.keep'),
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await loading.wrap(
        isRunning ? t('common.working.cancelRunning') : t('common.working.cancel'),
        () => cancel.mutateAsync({ id }),
      );
      toast.success(t('toast.cancel.ok'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      toast.error(t('toast.cancel.fail'), msg);
    }
  };

  if (!c.data) {
    return <p className="text-ink-muted">{t('common.loading')}</p>;
  }

  const d = c.data;
  const isListing = d.type === 'listing';
  const isRunning = d.status === 'running';
  const date = new Date(d.scheduledAt);

  // Compose title: listing campaigns get a structured one, posts use stored title.
  const titleNode: React.ReactNode = isListing
    ? (
        <>
          {d.bedrooms ?? '—'}{' '}
          {locale === 'th' ? 'ห้องนอน' : 'bed'}{' '}
          <span className="text-ink-muted">·</span>{' '}
          {translatePropertyType(d.propertyType, t)}{' '}
          <span className="text-ink-muted">·</span>{' '}
          <span className="text-[var(--accent)]">฿{d.priceBaht?.toLocaleString(loc) ?? ''}</span>
        </>
      )
    : (d.title ?? t('camp.untitled'));

  return (
    <div className="space-y-10 animate-rise">
      <div>
        <Link
          href="/campaigns"
          className="mb-6 inline-flex items-center gap-1.5 text-2xs uppercase tracking-[0.14em] text-ink-faint transition-colors hover:text-[var(--accent)]"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
            <path d="M6 2L3 5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t('camp.back')}
        </Link>

        <PageHeader
          eyebrow={
            <span className="inline-flex items-center gap-2">
              <span>{isListing ? t('camp.type.listing') : t('camp.type.post')}</span>
              <span className="text-ink-faint">#{d.id.slice(0, 8)}</span>
            </span>
          }
          title={titleNode}
          subtitle={
            <>
              {t('camp.scheduledFor')}{' '}
              <span className="tnum text-ink">
                {date.toLocaleDateString(loc, { day: '2-digit', month: 'long', year: 'numeric' })}
              </span>{' '}
              {t('camp.at')}{' '}
              <span className="tnum text-ink">
                {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
              </span>
              {' · '}
              <CampaignStatus status={d.status} />
            </>
          }
          actions={
            <>
              {d.status === 'paused' && (
                <Button variant="primary" size="sm" onClick={handleResume} disabled={resume.isPending}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
                    <path d="M3 1.5v9l8-4.5z" />
                  </svg>
                  {t('camp.resume')}
                </Button>
              )}
              {d.status !== 'completed' && d.status !== 'failed' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCancel(isRunning)}
                  disabled={cancel.isPending}
                >
                  {isRunning ? t('camp.cancelRunning') : t('camp.cancel')}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  router.push(`/campaigns/new/${isListing ? 'listing' : 'post'}?from=${id}`)
                }
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path
                    d="M3.5 1.5h5L10 3v5.5h-5V1.5ZM5 8.5V10.5H1.5V5h2"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {t('camp.duplicate')}
              </Button>
            </>
          }
        />
      </div>

      {/* ---------- Last error banner ---------- */}
      {d.lastError && (
        <Surface
          className={cn(
            'border-[color-mix(in_oklch,var(--danger)_45%,var(--border))]',
            'bg-[color-mix(in_oklch,var(--danger)_6%,var(--bg-raised))]',
          )}
        >
          <div className="flex items-start gap-4">
            <span
              aria-hidden
              className="mt-1 grid h-7 w-7 place-items-center rounded-full bg-[color-mix(in_oklch,var(--danger)_14%,transparent)] text-[var(--danger)]"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M7 4.5V8M7 10.2v.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <circle cx="7" cy="7" r="5.8" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </span>
            <div className="flex-1">
              <div className="small-caps text-[var(--danger)]">{t('camp.lastError')}</div>
              <p className="mt-1 font-mono text-sm text-ink">{d.lastError}</p>
            </div>
          </div>
        </Surface>
      )}

      {/* ---------- Property details (listing only) ---------- */}
      {isListing && (
        <Surface>
          <SectionHeader eyebrow={t('camp.eyebrow')} title={t('camp.section.property')} />
          <Divider />
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 pt-5 sm:grid-cols-2">
            <PropRow label={t('camp.prop.kind')} value={translateListingKind(d.listingKind, t)} />
            <PropRow label={t('camp.prop.type')} value={translatePropertyType(d.propertyType, t)} />
            <PropRow label={t('camp.prop.bedrooms')} value={d.bedrooms ?? '—'} tabular />
            <PropRow label={t('camp.prop.bathrooms')} value={d.bathrooms ?? '—'} tabular />
            <PropRow
              label={t('camp.prop.price')}
              value={
                d.priceBaht != null ? (
                  <span className="text-[var(--accent)] editorial-num">
                    ฿{d.priceBaht.toLocaleString(loc)}
                  </span>
                ) : '—'
              }
            />
            {d.squareMetres != null && (
              <PropRow label={t('camp.prop.sqm')} value={d.squareMetres} tabular />
            )}
            <PropRow label={t('camp.prop.location')} value={d.location ?? '—'} className="sm:col-span-2" />
          </dl>
        </Surface>
      )}

      {/* ---------- Content / Sent-to ---------- */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <Surface>
          <SectionHeader eyebrow={t('camp.content.eyebrow')} title={t('camp.content.title')} />
          <Divider />
          <pre className="whitespace-pre-wrap rounded-md bg-surface p-4 mt-5 font-sans text-[15px] leading-relaxed text-ink">
            {d.content}
          </pre>
        </Surface>

        <Surface>
          <SectionHeader
            eyebrow={t('camp.sent.eyebrow', {
              n: isListing
                ? d.batches?.reduce((sum, b) => sum + b.groups.length, 0) ?? 0
                : d.groups.length,
            })}
            title={t('camp.sent.title')}
          />
          <Divider />
          <ul className="divide-y divide-line pt-2">
            {!isListing && d.groups.map((cg) => (
              <li key={cg.groupId} className="flex items-center justify-between py-3">
                <span className="truncate text-sm text-ink">{cg.group.name ?? cg.group.fbGroupId}</span>
                <span className="tnum text-2xs text-ink-faint">
                  {cg.group.fbGroupId.slice(0, 12)}
                </span>
              </li>
            ))}
            {isListing && d.batches?.flatMap((b) => b.groups).map((g) => (
              <li key={g.groupId} className="flex items-center justify-between py-3">
                <span className="truncate text-sm text-ink">{g.group.name ?? g.group.fbGroupId}</span>
                <span className="tnum text-2xs text-ink-faint">
                  {g.group.fbGroupId.slice(0, 12)}
                </span>
              </li>
            ))}
            {((isListing ? (d.batches?.length ?? 0) : d.groups.length) === 0) && (
              <li className="py-3 text-sm text-ink-muted">{t('camp.sent.empty')}</li>
            )}
          </ul>
        </Surface>
      </section>

      {/* ---------- Batches (listing only) ---------- */}
      {isListing && (
        <section>
          <SectionHeader
            eyebrow={t('camp.section.batches.eyebrow', { n: d.batches?.length ?? 0 })}
            title={t('camp.section.batches.title')}
          />
          {(!d.batches || d.batches.length === 0) ? (
            <Surface>
              <p className="text-sm text-ink-muted">{t('camp.section.batches.empty')}</p>
            </Surface>
          ) : (
            <ul className="space-y-3">
              {d.batches.map((b) => {
                const primary = b.groups.find((g) => g.isPrimary);
                const shares = b.groups.filter((g) => !g.isPrimary);
                const batchDate = new Date(b.scheduledAt);
                return (
                  <li key={b.id}>
                    <Surface padded={false} className="px-5 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="font-display text-lg tracking-editorial text-ink">
                            {t('camp.batch.label', { n: b.order })}
                          </span>
                          <CampaignStatus status={b.status} />
                        </div>
                        <span className="tnum text-2xs text-ink-faint">
                          {batchDate.toLocaleString(loc, {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {' · '}
                          {t('camp.batch.groupCount', { n: b.groups.length })}
                        </span>
                      </div>

                      {primary && (
                        <p className="mt-2 text-sm text-ink-muted">
                          <span className="small-caps mr-2">{t('camp.batch.primary')}</span>
                          <span className="text-ink">
                            {primary.group.name ?? primary.group.fbGroupId}
                          </span>
                        </p>
                      )}

                      {shares.length > 0 && (
                        <p className="mt-1 truncate text-2xs text-ink-faint">
                          <span className="small-caps mr-2">{t('camp.batch.share')}</span>
                          {shares.map((s) => s.group.name ?? s.group.fbGroupId).join(' · ')}
                        </p>
                      )}

                      {b.lastError && (
                        <p className="mt-2 font-mono text-2xs text-[var(--danger)]">{b.lastError}</p>
                      )}

                      {b.fbPostUrl && (
                        <a
                          href={b.fbPostUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1.5 text-2xs text-[var(--accent)] underline-offset-4 hover:underline"
                        >
                          {t('common.openExternal')}
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                            <path
                              d="M3 1h6v6M9 1L3.5 6.5M1 5v4h4"
                              stroke="currentColor"
                              strokeWidth="1.3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </a>
                      )}
                    </Surface>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* ---------- Delivery log ---------- */}
      <section>
        <SectionHeader
          eyebrow={t('camp.log.eyebrow', { n: d.logs.length })}
          title={t('camp.log.title')}
        />
        {d.logs.length === 0 ? (
          <Surface>
            <p className="text-sm text-ink-muted">{t('camp.log.empty')}</p>
          </Surface>
        ) : (
          <Surface padded={false}>
            <Table>
              <THead>
                <tr>
                  <TH className="pl-6">{t('camp.log.th.group')}</TH>
                  <TH>{t('camp.log.th.result')}</TH>
                  <TH align="right" className="w-20 pr-8">{t('camp.log.th.attempt')}</TH>
                  <TH className="pl-2">{t('camp.log.th.error')}</TH>
                  <TH align="right" className="pr-6">{t('camp.log.th.completed')}</TH>
                </tr>
              </THead>
              <tbody>
                {d.logs.map((l) => {
                  // Listing campaigns put groups inside batches[]; posts in d.groups directly.
                  const grp =
                    d.groups.find((g) => g.groupId === l.groupId)?.group ??
                    d.batches?.flatMap((b) => b.groups).find((g) => g.groupId === l.groupId)?.group;
                  return (
                    <TRow key={l.id} interactive>
                      <TD className="pl-6">
                        <span className="font-medium text-ink">
                          {grp?.name ?? grp?.fbGroupId ?? '—'}
                        </span>
                      </TD>
                      <TD>
                        <StatusPill
                          tone={
                            l.status === 'success'
                              ? 'positive'
                              : l.status === 'failed'
                                ? 'danger'
                                : l.status === 'skipped'
                                  ? 'caution'
                                  : 'neutral'
                          }
                          dot
                        >
                          {l.status}
                          {l.note && ` · ${l.note}`}
                        </StatusPill>
                      </TD>
                      <TD align="right" tabular className="w-20 pr-8">
                        {l.attempt}
                      </TD>
                      <TD className="pl-2 max-w-xs">
                        {l.error ? (
                          <span className="truncate font-mono text-2xs text-[var(--danger)]">
                            {l.error}
                          </span>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </TD>
                      <TD align="right" tabular muted className="pr-6">
                        {l.completedAt
                          ? new Date(l.completedAt).toLocaleString(loc, {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </TD>
                    </TRow>
                  );
                })}
              </tbody>
            </Table>
          </Surface>
        )}
      </section>
    </div>
  );
}

/* -------------------------------------------------------- */

function PropRow({
  label,
  value,
  tabular = false,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  tabular?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <dt className="small-caps">{label}</dt>
      <dd className={cn('text-sm text-ink', tabular && 'tnum editorial-num text-base')}>
        {value}
      </dd>
    </div>
  );
}

function translatePropertyType(
  type: string | null | undefined,
  t: (k: TranslationKey) => string,
): string {
  if (!type) return '—';
  switch (type) {
    case 'flat':
      return t('listing.type.flat');
    case 'house':
      return t('listing.type.house');
    case 'townhouse':
      return t('listing.type.townhouse');
    default:
      return type;
  }
}

function translateListingKind(
  kind: string | null | undefined,
  t: (k: TranslationKey) => string,
): string {
  if (!kind) return '—';
  return kind === 'rent' ? t('listing.kind.rent') : t('listing.kind.sale');
}
