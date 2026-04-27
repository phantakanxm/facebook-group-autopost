'use client';
import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import type { MediaType } from '@app/shared';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Select, Field } from '@/components/ui/field';
import { Surface, SectionHeader, Divider } from '@/components/ui/section';
import { useConfirm, useToast, useLoading } from '@/components/ui/feedback';
import { useT, useLocale } from '@/lib/i18n';
import { cn } from '@/lib/cn';

interface MediaItem {
  path: string;       // absolute filesystem path (for worker/Playwright)
  url: string;        // HTTP URL served by /api/media/... (for preview)
  name: string;       // original filename
  size: number;
  type: string;       // MIME
  isHeic: boolean;
  previewUrl?: string; // client-side converted blob URL for HEIC; undefined until conversion resolves
  previewFailed?: boolean;
}

function isHeicFile(name: string, type: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return ext === 'heic' || ext === 'heif' || type === 'image/heic' || type === 'image/heif';
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function CampaignForm({
  initial,
  campaignId,
  cloneFromId,
  onSaved,
}: {
  initial?: { title?: string; content?: string; scheduledAt?: Date; recurrence?: string | null };
  campaignId?: string;
  /** When set, fetches the source campaign and pre-fills the form (except scheduledAt). */
  cloneFromId?: string;
  onSaved?: (id: string) => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const loc = locale === 'th' ? 'th-TH' : 'en-GB';

  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [scheduledAt, setScheduledAt] = useState(
    initial?.scheduledAt ? initial.scheduledAt.toISOString().slice(0, 16) : '',
  );
  const [recurrence, setRecurrence] = useState(initial?.recurrence ?? '');
  const [jitterMinutes, setJitterMinutes] = useState(15);
  const [mediaType, setMediaType] = useState<MediaType>('none');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  const groups = trpc.group.list.useQuery();
  const create = trpc.campaign.create.useMutation();
  const cloneSource = trpc.campaign.get.useQuery(
    { id: cloneFromId ?? '' },
    { enabled: !!cloneFromId },
  );
  const activeGroups = groups.data?.filter((g) => g.isActive) ?? [];
  const confirm = useConfirm();
  const toast = useToast();
  const loading = useLoading();

  // Pre-fill form from a source campaign (Duplicate flow)
  const [clonePrefilled, setClonePrefilled] = useState(false);
  useEffect(() => {
    if (!cloneFromId || clonePrefilled || !cloneSource.data) return;
    const src = cloneSource.data;
    if (src.title) setTitle(src.title);
    setContent(src.content);
    if (src.recurrence) setRecurrence(src.recurrence);
    setJitterMinutes(src.jitterMinutes);
    setMediaType(src.mediaType as MediaType);
    // Parse stored mediaFiles (JSON array of absolute paths). For preview, derive URL
    // from the path tail relative to the uploads root: `/api/media/{campaignId}/{file}`.
    const paths: string[] = (() => {
      try { return JSON.parse(src.mediaFiles) as string[]; } catch { return []; }
    })();
    const items: MediaItem[] = paths.map((p) => {
      const parts = p.split('/uploads/');
      const rel = parts.length > 1 ? parts[1]! : p.split('/').slice(-2).join('/');
      const name = rel.split('/').pop() ?? 'file';
      return {
        path: p,
        url: `/api/media/${rel.split('/').map(encodeURIComponent).join('/')}`,
        name,
        size: 0,
        type: '',
        isHeic: isHeicFile(name, ''),
      };
    });
    setMediaItems(items);
    setSelectedGroupIds(src.groups.map((cg) => cg.groupId));
    setClonePrefilled(true);
  }, [cloneFromId, cloneSource.data, clonePrefilled]);

  async function uploadFiles(files: FileList) {
    const tempId = campaignId ?? `temp-${Date.now()}`;
    const fd = new FormData();
    fd.append('campaignId', tempId);
    fd.append('kind', mediaType);
    Array.from(files).forEach((f) => fd.append('files', f));
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(t('form.toast.fail'), body.error ?? `Upload failed (${res.status})`);
      return;
    }
    type RawItem = { path: string; url: string; name: string; size: number; type: string };
    const data = (await res.json()) as { items: RawItem[] };
    setMediaItems((prev) => [
      ...prev,
      ...data.items.map<MediaItem>((it) => ({
        ...it,
        isHeic: isHeicFile(it.name, it.type),
      })),
    ]);
  }

  function removeMediaItem(index: number) {
    setMediaItems((prev) => {
      const next = [...prev];
      const removed = next.splice(index, 1)[0];
      // Revoke any blob URL we created locally
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  }

  // Convert HEIC files to JPEG blob URLs for preview (client-side)
  useEffect(() => {
    const toConvert = mediaItems
      .map((it, i) => ({ it, i }))
      .filter(({ it }) => it.isHeic && !it.previewUrl && !it.previewFailed);
    if (toConvert.length === 0) return;

    let cancelled = false;
    (async () => {
      // Dynamic import so heic2any only ships when actually needed
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

  // Revoke all blob URLs on unmount
  useEffect(() => () => {
    for (const it of mediaItems) {
      if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
    }
    // intentionally only on unmount — snapshot current items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectAll = () => setSelectedGroupIds(activeGroups.map((g) => g.id));
  const clearAll = () => setSelectedGroupIds([]);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (selectedGroupIds.length === 0) {
          toast.error(t('form.toast.noGroups'), t('form.toast.noGroups.desc'));
          return;
        }
        const when = new Date(scheduledAt);
        const whenStr = when.toLocaleString(loc, {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        const ok = await confirm({
          eyebrow: t('form.confirm.eyebrow'),
          title: t('form.confirm.title'),
          description: (
            <>
              {t('form.confirm.desc.to')}{' '}
              <strong className="text-ink">{selectedGroupIds.length}</strong>{' '}
              {t('form.confirm.desc.groups')} {t('form.confirm.desc.on')}{' '}
              <strong className="text-ink tnum">{whenStr}</strong>
              {recurrence && (
                <>
                  {' · '}
                  {t('form.confirm.desc.recurring')}{' '}
                  <code className="font-mono">{recurrence}</code>
                </>
              )}
            </>
          ),
          confirmLabel: t('form.confirm.cta'),
          cancelLabel: t('common.cancel'),
        });
        if (!ok) return;
        try {
          const result = await loading.wrap(t('common.working.submit'), () =>
            create.mutateAsync({
              title: title || undefined,
              content,
              mediaType,
              mediaFiles: mediaItems.map((m) => m.path),
              scheduledAt: when,
              recurrence: recurrence || null,
              jitterMinutes,
              groupIds: selectedGroupIds,
            }),
          );
          toast.success(
            t('form.toast.success'),
            t('form.toast.success.desc', {
              n: selectedGroupIds.length,
              when: when.toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
            }),
          );
          onSaved?.(result.id);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '';
          toast.error(t('form.toast.fail'), msg);
        }
      }}
      className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]"
    >
      <div className="space-y-8">
        <Surface>
          <SectionHeader eyebrow={t('form.step01')} title={t('form.section.message')} />
          <div className="space-y-5 pt-3">
            <Field label={t('form.field.title')} hint={t('form.field.title.hint')}>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('form.field.title.placeholder')}
              />
            </Field>

            <Field
              label={t('form.field.content')}
              required
              hint={t('form.field.content.hint', { n: content.length })}
            >
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                required
                placeholder={t('form.field.content.placeholder')}
              />
            </Field>
          </div>
        </Surface>

        <Surface>
          <SectionHeader eyebrow={t('form.step02')} title={t('form.section.attachments')} />
          <div className="space-y-5 pt-3">
            <Field label={t('form.field.media')}>
              <Select
                value={mediaType}
                onChange={(e) => {
                  setMediaType(e.target.value as MediaType);
                  // Revoke any blob URLs before clearing
                  for (const it of mediaItems) if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
                  setMediaItems([]);
                }}
              >
                <option value="none">{t('form.media.none')}</option>
                <option value="images">{t('form.media.images')}</option>
                <option value="video">{t('form.media.video')}</option>
              </Select>
            </Field>

            {mediaType !== 'none' && (
              <Field
                label={t('form.field.upload')}
                helper={
                  mediaItems.length > 0
                    ? t('form.upload.count', { n: mediaItems.length })
                    : t('form.upload.browse')
                }
              >
                <div className="space-y-3">
                  <label
                    className={cn(
                      'flex min-h-[96px] cursor-pointer flex-col items-center justify-center gap-2',
                      'rounded-md border border-dashed border-line-strong bg-surface px-4 py-5',
                      'transition-colors hover:border-[var(--accent)] hover:bg-accent-soft/50',
                    )}
                  >
                    <input
                      type="file"
                      multiple={mediaType === 'images'}
                      accept={
                        mediaType === 'video'
                          ? 'video/mp4,video/quicktime,video/webm,video/*'
                          : 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/avif,.heic,.heif'
                      }
                      onChange={(e) => {
                        if (e.target.files) uploadFiles(e.target.files);
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden className="text-ink-muted">
                      <path d="M10 13V4M6 8l4-4 4 4M3 16h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-sm text-ink-muted">
                      {mediaType === 'images' ? t('form.upload.chooseImages') : t('form.upload.chooseVideo')}
                    </span>
                  </label>

                  {mediaItems.length > 0 && (
                    <ul
                      className={cn(
                        'grid gap-3',
                        mediaType === 'images'
                          ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
                          : 'grid-cols-1',
                      )}
                    >
                      {mediaItems.map((it, i) => (
                        <li
                          key={it.path}
                          className="group relative overflow-hidden rounded-md border border-line bg-surface"
                        >
                          <div className="relative aspect-square w-full overflow-hidden bg-surface">
                            {mediaType === 'video' ? (
                              <video
                                src={it.url}
                                className="h-full w-full object-cover"
                                controls
                                preload="metadata"
                              />
                            ) : it.isHeic && !it.previewUrl ? (
                              it.previewFailed ? (
                                <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-ink-muted">
                                  HEIC<br />preview unavailable
                                </div>
                              ) : (
                                <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-ink-muted">
                                  <span className="animate-pulse">Converting HEIC…</span>
                                </div>
                              )
                            ) : (
                              <img
                                src={it.previewUrl ?? it.url}
                                alt={it.name}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs text-ink" title={it.name}>{it.name}</p>
                              <p className="text-2xs text-ink-faint tnum">{formatBytes(it.size)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeMediaItem(i)}
                              aria-label="Remove"
                              className="shrink-0 rounded p-1 text-ink-muted transition-colors hover:bg-[color-mix(in_oklch,var(--danger)_10%,transparent)] hover:text-[var(--danger)]"
                            >
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                              </svg>
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Field>
            )}
          </div>
        </Surface>

        <Surface>
          <SectionHeader eyebrow={t('form.step03')} title={t('form.section.timing')} />
          <div className="grid grid-cols-1 gap-5 pt-3 sm:grid-cols-2">
            <Field label={t('form.field.dispatchAt')} required>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
              />
            </Field>

            <Field label={t('form.field.jitter')} helper={t('form.field.jitter.helper')}>
              <Input
                type="number"
                min={0}
                max={120}
                value={jitterMinutes}
                onChange={(e) => setJitterMinutes(Number(e.target.value))}
              />
            </Field>

            <Field
              label={t('form.field.recurrence')}
              helper={t('form.field.recurrence.helper')}
              className="sm:col-span-2"
            >
              <Input
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value)}
                placeholder="0 9 * * MON"
                className="font-mono text-sm"
              />
            </Field>
          </div>
        </Surface>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <Surface padded={false}>
          <div className="flex items-center justify-between p-5 pb-4">
            <div className="flex flex-col">
              <span className="small-caps">{t('form.dest.eyebrow')}</span>
              <span className="mt-1 font-display text-lg tracking-editorial">
                {t('form.dest.title')}
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
              {t('form.dest.selectAll')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
              {t('form.dest.clear')}
            </Button>
          </div>

          <Divider />

          <div className="max-h-[420px] overflow-y-auto">
            {activeGroups.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-muted">
                {t('form.dest.noActive.before')}
                <a href="/groups" className="text-[var(--accent)] underline-offset-4 hover:underline">
                  {t('form.dest.noActive.link')}
                </a>
                {t('form.dest.noActive.after')}
              </p>
            ) : (
              <ul className="py-2">
                {activeGroups.map((g) => {
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
                          onChange={(e) => {
                            setSelectedGroupIds((prev) =>
                              e.target.checked ? [...prev, g.id] : prev.filter((id) => id !== g.id),
                            );
                          }}
                        />
                        <span className="truncate text-sm text-ink">{g.name ?? g.fbGroupId}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Surface>

        <div className="flex flex-col gap-3">
          <Button type="submit" size="lg" disabled={create.isPending}>
            {create.isPending ? t('form.submitting') : t('form.submit')}
          </Button>
          <p className="text-2xs text-ink-faint">{t('form.footer')}</p>
        </div>
      </aside>
    </form>
  );
}
