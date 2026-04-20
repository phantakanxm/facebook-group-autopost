'use client';
import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { PageHeader, Surface, SectionHeader, EmptyState } from '@/components/ui/section';
import { Textarea, Field } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { Table, THead, TH, TRow, TD } from '@/components/ui/table';
import { StatusPill } from '@/components/ui/status-pill';
import { useConfirm, useToast, useLoading } from '@/components/ui/feedback';
import { useT, useLocale } from '@/lib/i18n';
import { cn } from '@/lib/cn';

export default function GroupsPage() {
  const confirm = useConfirm();
  const toast = useToast();
  const loading = useLoading();
  const t = useT();
  const { locale } = useLocale();
  const loc = locale === 'th' ? 'th-TH' : 'en-GB';

  const list = trpc.group.list.useQuery();
  const bulk = trpc.group.bulkCreate.useMutation({ onSuccess: () => list.refetch() });
  const setActive = trpc.group.setActive.useMutation({ onSuccess: () => list.refetch() });
  const remove = trpc.group.remove.useMutation({ onSuccess: () => list.refetch() });
  const autoSync = trpc.group.requestAutoSync.useMutation({ onSuccess: () => list.refetch() });
  const capScan = trpc.group.requestCapabilityScan.useMutation({ onSuccess: () => list.refetch() });

  const [urls, setUrls] = useState('');
  const urlCount = urls.split('\n').map((s) => s.trim()).filter(Boolean).length;
  const activeCount = list.data?.filter((g) => g.isActive).length ?? 0;
  const totalCount = list.data?.length ?? 0;

  const handleBulkAdd = async () => {
    const arr = urls.split('\n').map((s) => s.trim()).filter(Boolean);
    if (arr.length === 0) return;
    const ok = await confirm({
      eyebrow: t('confirm.groups.add.eyebrow'),
      title: t('confirm.groups.add.title', { n: arr.length }),
      description: t('confirm.groups.add.desc'),
      confirmLabel: t('confirm.groups.add.cta'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    try {
      const res = await loading.wrap(
        t('common.working.addGroups'),
        () => bulk.mutateAsync({ urls: arr }),
      );
      setUrls('');
      toast.success(
        t('toast.groups.add.ok'),
        t('toast.groups.add.desc', { c: res.created.length, s: res.skipped.length }),
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      toast.error(t('toast.groups.add.fail'), msg);
    }
  };

  const handleAutoSync = async () => {
    const ok = await confirm({
      eyebrow: t('confirm.groups.sync.eyebrow'),
      title: t('confirm.groups.sync.title'),
      description: t('confirm.groups.sync.desc'),
      confirmLabel: t('confirm.groups.sync.cta'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    try {
      await loading.wrap(t('common.working.sync'), () => autoSync.mutateAsync());
      toast.info(t('toast.groups.sync.ok'), t('toast.groups.sync.ok.desc'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      toast.error(t('toast.groups.sync.fail'), msg);
    }
  };

  const handleCapabilityScan = async () => {
    const ok = await confirm({
      eyebrow: t('confirm.groups.scan.eyebrow'),
      title: t('confirm.groups.scan.title'),
      description: t('confirm.groups.scan.desc'),
      confirmLabel: t('confirm.groups.scan.cta'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    try {
      await loading.wrap(t('common.working.scan'), () => capScan.mutateAsync());
      toast.info(t('toast.groups.scan.ok'), t('toast.groups.scan.ok.desc'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      toast.error(t('toast.groups.scan.fail'), msg);
    }
  };

  const handleRemove = async (g: { id: string; name: string | null; fbGroupId: string }) => {
    const label = g.name ?? g.fbGroupId;
    const ok = await confirm({
      eyebrow: t('confirm.groups.remove.eyebrow'),
      title: t('confirm.groups.remove.title', { name: label }),
      description: t('confirm.groups.remove.desc'),
      confirmLabel: t('confirm.groups.remove.cta'),
      cancelLabel: t('confirm.groups.remove.keep'),
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await loading.wrap(t('common.working.remove'), () => remove.mutateAsync({ id: g.id }));
      toast.success(t('toast.groups.remove.ok'), label);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      toast.error(t('toast.groups.remove.fail'), msg);
    }
  };

  const handleToggleActive = async (g: { id: string; name: string | null; fbGroupId: string }, next: boolean) => {
    try {
      await loading.wrap(
        t('common.working.toggle'),
        () => setActive.mutateAsync({ id: g.id, isActive: next }),
      );
      toast.success(
        next ? t('toast.groups.enable.ok') : t('toast.groups.disable.ok'),
        g.name ?? g.fbGroupId,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      toast.error(t('toast.groups.toggle.fail'), msg);
    }
  };

  const addBtnLabel =
    urlCount === 0
      ? t('groups.add.button.empty')
      : urlCount === 1
        ? t('groups.add.button', { n: urlCount })
        : t('groups.add.button.plural', { n: urlCount });

  return (
    <div className="space-y-10 animate-rise">
      <PageHeader
        eyebrow={t('groups.eyebrow')}
        title={t('groups.title')}
        subtitle={t('groups.subtitle')}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleAutoSync} disabled={autoSync.isPending}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M12.5 3.5a5 5 0 1 0 .5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M12.5 1v3h-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t('groups.autosync')}
            </Button>
            <Button variant="outline" onClick={handleCapabilityScan} disabled={capScan.isPending}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M5 7h4M7 5v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              {t('groups.action.scanCapabilities')}
            </Button>
          </div>
        }
      />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <Surface>
          <SectionHeader
            eyebrow={t('groups.add.eyebrow')}
            title={t('groups.add.title')}
            actions={urlCount > 0 && (
              <span className="small-caps">{t('groups.add.detected', { n: urlCount })}</span>
            )}
          />
          <div className="space-y-4 pt-2">
            <Field helper={t('groups.add.helper')}>
              <Textarea
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                rows={6}
                placeholder="https://www.facebook.com/groups/123456789"
                className="font-mono text-[13px]"
              />
            </Field>
            <div className="flex items-center gap-3">
              <Button onClick={handleBulkAdd} disabled={bulk.isPending || urlCount === 0}>
                {bulk.isPending ? t('groups.add.adding') : addBtnLabel}
              </Button>
            </div>
          </div>
        </Surface>

        <Surface>
          <SectionHeader eyebrow={t('groups.summary.eyebrow')} title={t('groups.summary.title')} />
          <div className="grid grid-cols-2 gap-6 pt-3">
            <div className="flex flex-col gap-2">
              <span className="small-caps">{t('groups.summary.active')}</span>
              <span className="editorial-num text-[2.4rem] leading-none text-[var(--accent)]">
                {activeCount}
              </span>
              <span className="text-sm text-ink-muted">{t('groups.summary.active.helper')}</span>
            </div>
            <div className="flex flex-col gap-2">
              <span className="small-caps">{t('groups.summary.total')}</span>
              <span className="editorial-num text-[2.4rem] leading-none text-ink">
                {totalCount}
              </span>
              <span className="text-sm text-ink-muted">{t('groups.summary.total.helper')}</span>
            </div>
          </div>
        </Surface>
      </section>

      <section>
        <SectionHeader
          eyebrow={t('groups.roster.eyebrow', { n: totalCount })}
          title={t('groups.roster.title')}
        />
        {!list.data ? (
          <Surface><p className="text-ink-muted">{t('common.loading')}</p></Surface>
        ) : list.data.length === 0 ? (
          <Surface>
            <EmptyState
              title={t('groups.roster.empty.title')}
              description={t('groups.roster.empty.desc')}
            />
          </Surface>
        ) : (
          <Surface padded={false}>
            <Table>
              <THead>
                <tr>
                  <TH className="pl-6 w-16">{t('groups.th.status')}</TH>
                  <TH>{t('groups.th.group')}</TH>
                  <TH>{t('groups.th.url')}</TH>
                  <TH>{t('groups.th.capability')}</TH>
                  <TH align="right">{t('groups.th.lastPosted')}</TH>
                  <TH className="pr-6 w-16" align="right">{''}</TH>
                </tr>
              </THead>
              <tbody>
                {list.data.map((g) => (
                  <TRow key={g.id} interactive>
                    <TD className="pl-6">
                      <label className="inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          checked={g.isActive}
                          onChange={(e) => handleToggleActive(g, e.target.checked)}
                          className="peer sr-only"
                        />
                        <span
                          className={cn(
                            'relative inline-flex h-[18px] w-[30px] items-center rounded-full',
                            'bg-line-strong transition-colors duration-200',
                            'peer-checked:bg-[var(--accent)]',
                          )}
                        >
                          <span
                            className={cn(
                              'inline-block h-[14px] w-[14px] translate-x-[2px] rounded-full bg-raised',
                              'transition-transform duration-200 ease-out-quart',
                              g.isActive && 'translate-x-[14px]',
                            )}
                          />
                        </span>
                      </label>
                    </TD>
                    <TD>
                      <span className="font-medium text-ink">{g.name ?? g.fbGroupId}</span>
                      {g.name && (
                        <span className="ml-2 text-2xs text-ink-faint tnum">{g.fbGroupId}</span>
                      )}
                    </TD>
                    <TD muted>
                      <a
                        href={g.fbUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-[280px] items-center gap-1 truncate text-sm text-ink-muted underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
                      >
                        <span className="truncate">{g.fbUrl}</span>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                          <path d="M3 1h6v6M9 1L3.5 6.5M1 5v4h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </a>
                    </TD>
                    <TD>
                      {g.listingScannedAt === null ? (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-2xs font-medium text-amber-800">
                          {t('groups.badge.notScanned')}
                        </span>
                      ) : g.supportsListing ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-2xs font-medium text-green-800">
                          {t('groups.badge.listingOk')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-neutral-200 px-2 py-0.5 text-2xs font-medium text-neutral-700">
                          {t('groups.badge.listingNo')}
                        </span>
                      )}
                    </TD>
                    <TD align="right" tabular muted>
                      {g.lastPosted
                        ? new Date(g.lastPosted).toLocaleDateString(loc, { day: '2-digit', month: 'short' })
                        : <StatusPill tone="neutral">{t('common.never')}</StatusPill>}
                    </TD>
                    <TD align="right" className="pr-6">
                      <button
                        onClick={() => handleRemove(g)}
                        className="text-2xs uppercase tracking-[0.14em] text-ink-faint transition-colors hover:text-[var(--danger)]"
                      >
                        {t('common.remove')}
                      </button>
                    </TD>
                  </TRow>
                ))}
              </tbody>
            </Table>
          </Surface>
        )}
      </section>
    </div>
  );
}
