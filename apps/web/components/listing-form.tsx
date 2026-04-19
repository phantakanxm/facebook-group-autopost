'use client';
import { useEffect, useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import type { ListingKind, PropertyType } from '@app/shared';
import { MAX_PHOTOS_PER_LISTING, MAX_GROUPS_PER_BATCH } from '@app/shared';
import { BatchPreview } from './batch-preview';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Select, Field } from '@/components/ui/field';
import { Surface, SectionHeader, Divider } from '@/components/ui/section';
import { useConfirm, useToast, useLoading } from '@/components/ui/feedback';
import { useT, useLocale } from '@/lib/i18n';
import { cn } from '@/lib/cn';

interface MediaItem {
  path: string;
  url: string;
  name: string;
  size: number;
  type: string;
  isHeic: boolean;
  previewUrl?: string;
  previewFailed?: boolean;
}

function isHeicFile(name: string, type: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return ext === 'heic' || ext === 'heif' || type === 'image/heic' || type === 'image/heif';
}

export function ListingForm({ onSaved }: { onSaved?: (id: string) => void }) {
  const t = useT();
  const { locale } = useLocale();
  const loc = locale === 'th' ? 'th-TH' : 'en-GB';

  const [listingKind, setListingKind] = useState<ListingKind>('sale');
  const [propertyType, setPropertyType] = useState<PropertyType>('house');
  const [bedrooms, setBedrooms] = useState<number>(3);
  const [bathrooms, setBathrooms] = useState<number>(2);
  const [priceBaht, setPriceBaht] = useState<number>(0);
  const [squareMetres, setSquareMetres] = useState<number | ''>('');
  const [location, setLocation] = useState('');
  const [content, setContent] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  // Jitter not exposed in UI for listings — batch spacing is controlled by
  // delayBetweenBatches* in Settings. Send 0 to skip start-time jitter.
  const jitterMinutes = 0;
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  const groups = trpc.group.list.useQuery();
  const settings = trpc.setting.get.useQuery();
  const scan = trpc.group.requestCapabilityScan.useMutation();
  const create = trpc.campaign.createListing.useMutation();

  const confirm = useConfirm();
  const toast = useToast();
  const loading = useLoading();

  const listingGroups = useMemo(
    () => (groups.data ?? []).filter((g) => g.isActive && g.supportsListing),
    [groups.data],
  );

  async function uploadFiles(files: FileList) {
    const tempId = `temp-${Date.now()}`;
    const fd = new FormData();
    fd.append('campaignId', tempId);
    fd.append('kind', 'images');
    Array.from(files).forEach((f) => fd.append('files', f));
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(t('listing.toast.uploadFail'), body.error ?? `(${res.status})`);
      return;
    }
    type RawItem = { path: string; url: string; name: string; size: number; type: string };
    const data = (await res.json()) as { items: RawItem[] };
    setMediaItems((prev) => [
      ...prev,
      ...data.items.map<MediaItem>((it) => ({ ...it, isHeic: isHeicFile(it.name, it.type) })),
    ]);
  }

  function removeMediaItem(index: number) {
    setMediaItems((prev) => {
      const next = [...prev];
      const removed = next.splice(index, 1)[0];
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  }

  // HEIC → JPEG conversion for preview
  useEffect(() => {
    const toConvert = mediaItems
      .map((it, i) => ({ it, i }))
      .filter(({ it }) => it.isHeic && !it.previewUrl && !it.previewFailed);
    if (toConvert.length === 0) return;
    let cancelled = false;
    (async () => {
      const { default: heic2any } = await import('heic2any');
      for (const { it, i } of toConvert) {
        if (cancelled) return;
        try {
          const res = await fetch(it.url);
          const blob = await res.blob();
          const converted = await heic2any({ blob, toType: 'image/jpeg', quality: 0.7 });
          const finalBlob = Array.isArray(converted) ? converted[0]! : converted;
          const previewUrl = URL.createObjectURL(finalBlob);
          if (cancelled) { URL.revokeObjectURL(previewUrl); return; }
          setMediaItems((prev) => {
            const next = [...prev];
            if (next[i]?.path === it.path) next[i] = { ...next[i]!, previewUrl };
            return next;
          });
        } catch {
          setMediaItems((prev) => {
            const next = [...prev];
            if (next[i]?.path === it.path) next[i] = { ...next[i]!, previewFailed: true };
            return next;
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [mediaItems]);

  const baseAt = scheduledAt ? new Date(scheduledAt) : null;
  const minDelayMinutes = Math.round((settings.data?.delayBetweenBatchesMinMs ?? 1_800_000) / 60_000);
  const maxDelayMinutes = Math.round((settings.data?.delayBetweenBatchesMaxMs ?? 3_600_000) / 60_000);

  const selectAll = () => setSelectedGroupIds(listingGroups.map((g) => g.id));
  const clearAll = () => setSelectedGroupIds([]);

  // ---------- No-groups empty state ----------
  if (!groups.isLoading && listingGroups.length === 0) {
    return (
      <Surface>
        <div className="flex flex-col items-start gap-4">
          <span
            aria-hidden
            className="grid h-10 w-10 place-items-center rounded-full bg-[color-mix(in_oklch,var(--caution)_15%,transparent)] text-[var(--caution)]"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M9 6.5v3M9 11.7v.1"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <path
                d="M9 2.5L16 15H2L9 2.5Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="flex flex-col gap-2">
            <h3 className="font-display text-xl tracking-editorial text-ink">
              {t('listing.noGroups.title')}
            </h3>
            <p className="max-w-[56ch] text-sm text-ink-muted">
              {t('listing.noGroups.desc')}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await loading.wrap(t('common.working.scan'), () => scan.mutateAsync());
                toast.info(t('toast.groups.scan.ok'), t('toast.groups.scan.ok.desc'));
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : '';
                toast.error(t('toast.groups.scan.fail'), msg);
              }
            }}
            disabled={scan.isPending}
          >
            {scan.isPending ? t('listing.noGroups.pending') : t('listing.noGroups.cta')}
          </Button>
        </div>
      </Surface>
    );
  }

  // ---------- Main form ----------
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (selectedGroupIds.length === 0) {
          toast.error(t('listing.err.noGroups'));
          return;
        }
        if (mediaItems.length === 0) {
          toast.error(t('listing.err.noPhotos'));
          return;
        }
        const fullBatches = Math.floor(selectedGroupIds.length / MAX_GROUPS_PER_BATCH);
        const remainder = selectedGroupIds.length % MAX_GROUPS_PER_BATCH;
        const batchCount = fullBatches + (remainder > 0 ? 1 : 0);
        const ok = await confirm({
          eyebrow: t('listing.confirm.eyebrow'),
          title: t('listing.confirm.title'),
          description: t('listing.confirm.desc', {
            n: selectedGroupIds.length,
            b: batchCount,
          }),
          confirmLabel: t('listing.confirm.cta'),
          cancelLabel: t('common.cancel'),
        });
        if (!ok) return;
        try {
          const result = await loading.wrap(t('common.working.submit'), () =>
            create.mutateAsync({
              listingKind,
              propertyType,
              bedrooms,
              bathrooms,
              priceBaht,
              squareMetres: typeof squareMetres === 'number' ? squareMetres : null,
              location,
              content,
              scheduledAt: new Date(scheduledAt),
              jitterMinutes,
              mediaFiles: mediaItems.map((m) => m.path),
              groupIds: selectedGroupIds,
            }),
          );
          toast.success(
            t('listing.toast.ok'),
            t('listing.toast.ok.desc', { n: selectedGroupIds.length, b: batchCount }),
          );
          onSaved?.(result.id);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '';
          toast.error(t('listing.toast.fail'), msg);
        }
      }}
      className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]"
    >
      {/* ------------- Main column ------------- */}
      <div className="space-y-8">
        {/* Property details */}
        <Surface>
          <SectionHeader eyebrow={t('form.step01')} title={t('listing.section.property')} />
          <div className="space-y-5 pt-3">
            {/* Sale / Rent segmented */}
            <Field label={t('listing.field.propertyType')}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div
                  role="tablist"
                  className="inline-flex h-10 items-center rounded-md border border-line-strong bg-surface p-0.5"
                >
                  {(['sale', 'rent'] as const).map((k) => {
                    const active = listingKind === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setListingKind(k)}
                        className={cn(
                          'relative z-10 inline-flex h-9 items-center justify-center rounded-[5px] px-5',
                          'text-sm font-medium transition-colors duration-200',
                          active
                            ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                            : 'text-ink-muted hover:text-ink',
                        )}
                      >
                        {k === 'sale' ? t('listing.kind.sale') : t('listing.kind.rent')}
                      </button>
                    );
                  })}
                </div>
                <Select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                  className="sm:max-w-[220px]"
                >
                  <option value="flat">{t('listing.type.flat')}</option>
                  <option value="house">{t('listing.type.house')}</option>
                  <option value="townhouse">{t('listing.type.townhouse')}</option>
                </Select>
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label={t('listing.field.bedrooms')}>
                <Input
                  type="number"
                  min={0}
                  value={bedrooms}
                  onChange={(e) => setBedrooms(Number(e.target.value))}
                  className="tnum"
                />
              </Field>
              <Field label={t('listing.field.bathrooms')}>
                <Input
                  type="number"
                  min={0}
                  value={bathrooms}
                  onChange={(e) => setBathrooms(Number(e.target.value))}
                  className="tnum"
                />
              </Field>
              <Field label={t('listing.field.price')} required hint={t('listing.field.price.suffix')}>
                <Input
                  type="number"
                  min={0}
                  value={priceBaht}
                  onChange={(e) => setPriceBaht(Number(e.target.value))}
                  required
                  className="tnum"
                />
              </Field>
              <Field
                label={t('listing.field.sqm')}
                hint={`${t('listing.field.sqm.suffix')} · ${t('listing.field.sqm.hint')}`}
              >
                <Input
                  type="number"
                  min={1}
                  value={squareMetres}
                  onChange={(e) =>
                    setSquareMetres(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="tnum"
                />
              </Field>
            </div>
          </div>
        </Surface>

        {/* Location */}
        <Surface>
          <SectionHeader eyebrow={t('form.step02')} title={t('listing.section.location')} />
          <div className="space-y-2 pt-3">
            <Field helper={t('listing.field.location.hint')}>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t('listing.field.location.placeholder')}
                required
              />
            </Field>
          </div>
        </Surface>

        {/* Description */}
        <Surface>
          <SectionHeader eyebrow={t('form.step03')} title={t('listing.section.description')} />
          <div className="pt-3">
            <Field>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={7}
                required
                placeholder={t('listing.field.description.placeholder')}
              />
            </Field>
          </div>
        </Surface>

        {/* Photos */}
        <Surface>
          <SectionHeader
            eyebrow={t('form.step04.eyebrow').split(' · ')[0]}
            title={t('listing.section.photos')}
            actions={
              <span className="small-caps">
                <span className="editorial-num text-base tnum">{mediaItems.length}</span>
                {' / '}
                <span className="tnum">{MAX_PHOTOS_PER_LISTING}</span>
              </span>
            }
          />
          <div className="space-y-4 pt-3">
            <label
              className={cn(
                'flex min-h-[112px] cursor-pointer flex-col items-center justify-center gap-2',
                'rounded-md border border-dashed border-line-strong bg-surface px-4 py-5 text-center',
                'transition-colors hover:border-[var(--accent)] hover:bg-accent-soft/50',
              )}
            >
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) uploadFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden className="text-ink-muted">
                <path
                  d="M11 14V4M7 8l4-4 4 4M3 18h16"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-sm text-ink-muted">{t('listing.upload.cta')}</span>
              <span className="text-2xs text-ink-faint">{t('listing.upload.hint')}</span>
            </label>

            {mediaItems.length > 0 && (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {mediaItems.map((it, i) => (
                  <li
                    key={it.path}
                    className="relative overflow-hidden rounded-md border border-line bg-surface"
                  >
                    <div className="aspect-square w-full">
                      {it.isHeic && !it.previewUrl ? (
                        <div className="flex h-full items-center justify-center p-2 text-center text-2xs text-ink-faint">
                          {it.previewFailed
                            ? t('listing.heic.failed')
                            : t('listing.heic.converting')}
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.previewUrl ?? it.url}
                          alt={it.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMediaItem(i)}
                      className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-ink/70 text-[var(--accent-ink)] transition hover:bg-[var(--danger)]"
                      aria-label="Remove"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path
                          d="M2.5 2.5l5 5M7.5 2.5l-5 5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Surface>

        {/* Schedule */}
        <Surface>
          <SectionHeader eyebrow="Step 05" title={t('listing.section.schedule')} />
          <div className="grid grid-cols-1 gap-4 pt-3 sm:grid-cols-2">
            <Field label={t('listing.field.scheduledAt')} required>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
              />
            </Field>
          </div>
        </Surface>
      </div>

      {/* ------------- Sidebar ------------- */}
      <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <Surface padded={false}>
          <div className="flex items-center justify-between p-5 pb-4">
            <div className="flex flex-col">
              <span className="small-caps">{t('listing.section.targets')}</span>
              <span className="mt-1 font-display text-lg tracking-editorial">
                {t('listing.section.targets.count', { n: selectedGroupIds.length })}
              </span>
            </div>
            <span
              className={cn(
                'editorial-num text-2xl leading-none tnum',
                selectedGroupIds.length > 0 ? 'text-[var(--accent)]' : 'text-ink-faint',
              )}
            >
              {selectedGroupIds.length}
            </span>
          </div>

          <div className="flex gap-2 px-5 pb-3">
            <Button type="button" variant="ghost" size="sm" onClick={selectAll}>
              {t('listing.selectAll')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
              {t('listing.clear')}
            </Button>
          </div>

          <Divider />

          <div className="max-h-[360px] overflow-y-auto">
            <ul className="py-2">
              {listingGroups.map((g) => {
                const isChecked = selectedGroupIds.includes(g.id);
                return (
                  <li key={g.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-3 px-5 py-2.5 transition-colors',
                        isChecked ? 'bg-accent-soft/40' : 'hover:bg-surface',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) =>
                          setSelectedGroupIds((prev) =>
                            e.target.checked ? [...prev, g.id] : prev.filter((id) => id !== g.id),
                          )
                        }
                      />
                      <span className="truncate text-sm text-ink">{g.name ?? g.fbGroupId}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </Surface>

        <BatchPreview
          selectedCount={selectedGroupIds.length}
          maxPerBatch={MAX_GROUPS_PER_BATCH}
          baseAt={baseAt}
          minDelayMinutes={minDelayMinutes}
          maxDelayMinutes={maxDelayMinutes}
          locale={loc}
        />

        <Button type="submit" size="lg" disabled={create.isPending} className="w-full">
          {create.isPending ? t('listing.submitting') : t('listing.submit')}
        </Button>
      </aside>
    </form>
  );
}
