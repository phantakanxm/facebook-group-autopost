'use client';
import { trpc } from '@/lib/trpc-client';
import { useEffect, useState } from 'react';
import { PageHeader, Surface, SectionHeader, Divider } from '@/components/ui/section';
import { Input, Field } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { useConfirm, useToast, useLoading } from '@/components/ui/feedback';
import { useT, type TranslationKey } from '@/lib/i18n';
import { cn } from '@/lib/cn';

type Values = {
  delayBetweenGroupsMinMs: number; delayBetweenGroupsMaxMs: number;
  delayBeforePostMinMs: number; delayBeforePostMaxMs: number;
  delayAfterFocusMinMs: number; delayAfterFocusMaxMs: number;
  maxRetryPerGroup: number;
  retryDelayMinMs: number; retryDelayMaxMs: number;
  stopAfterConsecutiveFailures: number;
  delayBetweenBatchesMinMs: number; delayBetweenBatchesMaxMs: number;
  maxBatchesPerDay: number;
  enableMouseMove: boolean; enableScrollBeforePost: boolean; enableJitter: boolean;
};

const PAIRS: Array<[keyof Values, keyof Values, TranslationKey, TranslationKey]> = [
  ['delayBetweenGroupsMinMs', 'delayBetweenGroupsMaxMs', 'settings.delay.groups', 'settings.delay.groups.hint'],
  ['delayBeforePostMinMs',    'delayBeforePostMaxMs',    'settings.delay.post',   'settings.delay.post.hint'],
  ['delayAfterFocusMinMs',    'delayAfterFocusMaxMs',    'settings.delay.focus',  'settings.delay.focus.hint'],
  ['retryDelayMinMs',         'retryDelayMaxMs',         'settings.delay.retry',  'settings.delay.retry.hint'],
  ['delayBetweenBatchesMinMs','delayBetweenBatchesMaxMs','settings.listing.delay','settings.listing.delay.hint'],
];

export default function SettingsPage() {
  const get = trpc.setting.get.useQuery();
  const update = trpc.setting.update.useMutation({ onSuccess: () => get.refetch() });
  const [v, setV] = useState<Values | null>(null);
  const confirm = useConfirm();
  const toast = useToast();
  const loading = useLoading();
  const t = useT();

  useEffect(() => {
    if (get.data && !v) {
      const { id, userId, ...rest } = get.data;
      setV(rest as Values);
    }
  }, [get.data, v]);

  if (!v) return <p className="text-ink-muted">{t('common.loading')}</p>;
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV({ ...v, [k]: val });

  const handleSave = async () => {
    const ok = await confirm({
      eyebrow: t('confirm.settings.eyebrow'),
      title: t('confirm.settings.title'),
      description: t('confirm.settings.desc'),
      confirmLabel: t('confirm.settings.cta'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    try {
      await loading.wrap(t('common.working.saveSettings'), () => update.mutateAsync(v));
      toast.success(t('toast.settings.ok'), t('toast.settings.ok.desc'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      toast.error(t('toast.settings.fail'), msg);
    }
  };

  return (
    <div className="space-y-10 animate-rise">
      <PageHeader
        eyebrow={t('settings.eyebrow')}
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        actions={
          <Button onClick={handleSave} disabled={update.isPending} size="md">
            {update.isPending ? t('settings.saving') : t('settings.save')}
          </Button>
        }
      />

      <Surface>
        <SectionHeader eyebrow={t('settings.timing.eyebrow')} title={t('settings.timing.title')} />
        <Divider />
        <div className="space-y-6 pt-5">
          {PAIRS.map(([kmin, kmax, labelKey, hintKey]) => (
            <div
              key={kmin as string}
              className="grid grid-cols-1 items-start gap-4 md:grid-cols-[260px_1fr]"
            >
              <div className="pt-1">
                <div className="text-sm font-medium text-ink">{t(labelKey)}</div>
                <div className="mt-1 text-2xs text-ink-faint">{t(hintKey)}</div>
              </div>
              <div className="flex items-center gap-3">
                <Field label={t('settings.pair.min')} className="w-32">
                  <Input
                    type="number"
                    value={v[kmin] as number}
                    onChange={(e) => set(kmin, Number(e.target.value) as Values[typeof kmin])}
                    className="tnum"
                  />
                </Field>
                <span className="mt-6 text-ink-faint">—</span>
                <Field label={t('settings.pair.max')} className="w-32">
                  <Input
                    type="number"
                    value={v[kmax] as number}
                    onChange={(e) => set(kmax, Number(e.target.value) as Values[typeof kmax])}
                    className="tnum"
                  />
                </Field>
                <span className="mt-6 text-2xs text-ink-faint">{t('settings.pair.ms')}</span>
              </div>
            </div>
          ))}
        </div>
      </Surface>

      <Surface>
        <SectionHeader eyebrow={t('settings.retry.eyebrow')} title={t('settings.retry.title')} />
        <Divider />
        <div className="space-y-6 pt-5">
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[260px_1fr]">
            <div className="pt-1">
              <div className="text-sm font-medium text-ink">{t('settings.retry.max')}</div>
              <div className="mt-1 text-2xs text-ink-faint">{t('settings.retry.max.hint')}</div>
            </div>
            <Field className="w-32">
              <Input
                type="number"
                value={v.maxRetryPerGroup}
                onChange={(e) => set('maxRetryPerGroup', Number(e.target.value))}
                className="tnum"
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[260px_1fr]">
            <div className="pt-1">
              <div className="text-sm font-medium text-ink">{t('settings.retry.stop')}</div>
              <div className="mt-1 text-2xs text-ink-faint">{t('settings.retry.stop.hint')}</div>
            </div>
            <Field className="w-32">
              <Input
                type="number"
                value={v.stopAfterConsecutiveFailures}
                onChange={(e) => set('stopAfterConsecutiveFailures', Number(e.target.value))}
                className="tnum"
              />
            </Field>
          </div>
        </div>
      </Surface>

      <Surface>
        <SectionHeader eyebrow={t('settings.listing.eyebrow')} title={t('settings.listing.title')} />
        <Divider />
        <div className="space-y-6 pt-5">
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[260px_1fr]">
            <div className="pt-1">
              <div className="text-sm font-medium text-ink">{t('settings.listing.maxbatches')}</div>
              <div className="mt-1 text-2xs text-ink-faint">{t('settings.listing.maxbatches.hint')}</div>
            </div>
            <Field className="w-32">
              <Input
                type="number"
                value={v.maxBatchesPerDay}
                onChange={(e) => set('maxBatchesPerDay', Number(e.target.value))}
                className="tnum"
              />
            </Field>
          </div>
        </div>
      </Surface>

      <Surface>
        <SectionHeader eyebrow={t('settings.behaviour.eyebrow')} title={t('settings.behaviour.title')} />
        <Divider />
        <div className="divide-y divide-line pt-2">
          <ToggleRow
            label={t('settings.toggle.mouse')}
            hint={t('settings.toggle.mouse.hint')}
            checked={v.enableMouseMove}
            onChange={(val) => set('enableMouseMove', val)}
          />
          <ToggleRow
            label={t('settings.toggle.scroll')}
            hint={t('settings.toggle.scroll.hint')}
            checked={v.enableScrollBeforePost}
            onChange={(val) => set('enableScrollBeforePost', val)}
          />
          <ToggleRow
            label={t('settings.toggle.jitter')}
            hint={t('settings.toggle.jitter.hint')}
            checked={v.enableJitter}
            onChange={(val) => set('enableJitter', val)}
          />
        </div>
      </Surface>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: React.ReactNode;
  hint: React.ReactNode;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-6 py-4">
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className="mt-1 text-2xs text-ink-faint">{hint}</span>
      </div>
      <span className="flex shrink-0 items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          className={cn(
            'relative inline-flex h-6 w-10 items-center rounded-full transition-colors duration-200',
            checked ? 'bg-[var(--accent)]' : 'bg-line-strong',
          )}
        >
          <span
            className={cn(
              'inline-block h-4 w-4 translate-x-1 rounded-full bg-raised shadow-sm transition-transform duration-200 ease-out-quart',
              checked && 'translate-x-[1.375rem]',
            )}
          />
        </span>
      </span>
    </label>
  );
}
