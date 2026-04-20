'use client';
import { trpc } from '@/lib/trpc-client';
import { PageHeader, Surface, Divider } from '@/components/ui/section';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { useConfirm, useToast, useLoading } from '@/components/ui/feedback';
import { useT, useLocale } from '@/lib/i18n';
import { cn } from '@/lib/cn';

export default function SessionPage() {
  const status = trpc.session.status.useQuery();
  const setup = trpc.session.requestSetup.useMutation({ onSuccess: () => status.refetch() });
  const verify = trpc.session.requestVerify.useMutation({ onSuccess: () => status.refetch() });
  const valid = status.data?.valid ?? false;
  const confirm = useConfirm();
  const toast = useToast();
  const loading = useLoading();
  const t = useT();
  const { locale } = useLocale();
  const loc = locale === 'th' ? 'th-TH' : 'en-GB';

  const handleSetup = async () => {
    const ok = await confirm({
      eyebrow: t('confirm.session.setup.eyebrow'),
      title: t('confirm.session.setup.title'),
      description: t('confirm.session.setup.desc'),
      confirmLabel: t('confirm.session.setup.cta'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    try {
      await loading.wrap(t('common.working.openBrowser'), () => setup.mutateAsync());
      toast.info(t('toast.session.setup.ok'), t('toast.session.setup.ok.desc'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      toast.error(t('toast.session.setup.fail'), msg);
    }
  };

  const handleVerify = async () => {
    const ok = await confirm({
      eyebrow: t('confirm.session.verify.eyebrow'),
      title: t('confirm.session.verify.title'),
      description: t('confirm.session.verify.desc'),
      confirmLabel: t('confirm.session.verify.cta'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    try {
      const result = await loading.wrap(
        t('common.working.verify'),
        () => verify.mutateAsync(),
      );
      const isValid = (result as { valid?: boolean } | undefined)?.valid ?? true;
      if (isValid) {
        toast.success(t('toast.session.verify.ok'), t('toast.session.verify.ok.desc'));
      } else {
        toast.error(t('toast.session.verify.fail'), t('toast.session.verify.fail.desc'));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      toast.error(t('toast.session.verify.fail'), msg);
    }
  };

  return (
    <div className="space-y-10 animate-rise">
      <PageHeader
        eyebrow={t('session.eyebrow')}
        title={t('session.title')}
        subtitle={t('session.subtitle')}
      />

      <Surface>
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <span
              aria-hidden
              className={cn(
                'grid h-12 w-12 place-items-center rounded-full border',
                valid
                  ? 'border-[var(--positive)]/30 bg-[color-mix(in_oklch,var(--positive)_12%,transparent)] text-[var(--positive)]'
                  : 'border-[var(--danger)]/30 bg-[color-mix(in_oklch,var(--danger)_12%,transparent)] text-[var(--danger)]',
              )}
            >
              {valid ? (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 9.5L7.5 13L14 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M5.5 5.5l7 7M12.5 5.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              )}
            </span>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <span className="font-display text-xl tracking-editorial">
                  {valid ? t('session.active.title') : t('session.invalid.title')}
                </span>
                <StatusPill tone={valid ? 'positive' : 'danger'} dot pulse={valid}>
                  {valid ? t('session.badge.ready') : t('session.badge.actionReq')}
                </StatusPill>
              </div>
              <p className="text-sm text-ink-muted">
                {valid ? t('session.active.desc') : t('session.invalid.desc')}
                {status.data?.checkedAt && (
                  <span className="ml-1 text-ink-faint">
                    · {t('session.checked')}{' '}
                    {new Date(status.data.checkedAt).toLocaleString(loc, {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </Surface>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Surface className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <span className="font-display text-[44px] leading-none text-[var(--accent)]" aria-hidden>
              01
            </span>
            <StatusPill tone="accent">{t('session.badge.browser')}</StatusPill>
          </div>
          <Divider />
          <div className="flex flex-col gap-2">
            <h3 className="font-display text-xl tracking-editorial">{t('session.step01.title')}</h3>
            <p className="text-sm text-ink-muted">{t('session.step01.desc')}</p>
          </div>
          <div>
            <Button onClick={handleSetup} disabled={setup.isPending} size="md">
              {setup.isPending ? t('session.step01.loading') : t('session.step01.cta')}
            </Button>
          </div>
        </Surface>

        <Surface className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <span className="font-display text-[44px] leading-none text-[var(--accent)]" aria-hidden>
              02
            </span>
            <StatusPill tone="neutral">{t('session.badge.verify')}</StatusPill>
          </div>
          <Divider />
          <div className="flex flex-col gap-2">
            <h3 className="font-display text-xl tracking-editorial">{t('session.step02.title')}</h3>
            <p className="text-sm text-ink-muted">{t('session.step02.desc')}</p>
          </div>
          <div>
            <Button variant="outline" onClick={handleVerify} disabled={verify.isPending} size="md">
              {verify.isPending ? t('session.step02.loading') : t('session.step02.cta')}
            </Button>
          </div>
        </Surface>
      </section>

      <Surface className="bg-surface/50">
        <div className="flex items-start gap-3">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="mt-0.5 text-ink-muted">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M8 5V8M8 10.5v.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <div className="flex-1 text-sm text-ink-muted">
            <span className="text-ink">{t('session.why.head')}</span> {t('session.why.body')}
          </div>
        </div>
      </Surface>
    </div>
  );
}
