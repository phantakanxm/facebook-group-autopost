'use client';
import { useEffect, useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import type { ListingKind, PropertyType } from '@app/shared';
import { MAX_PHOTOS_PER_LISTING, MAX_GROUPS_PER_BATCH } from '@app/shared';
import { BatchPreview } from './batch-preview';

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
  const [listingKind, setListingKind] = useState<ListingKind>('sale');
  const [propertyType, setPropertyType] = useState<PropertyType>('house');
  const [bedrooms, setBedrooms] = useState<number>(3);
  const [bathrooms, setBathrooms] = useState<number>(2);
  const [priceBaht, setPriceBaht] = useState<number>(0);
  const [squareMetres, setSquareMetres] = useState<number | ''>('');
  const [location, setLocation] = useState('');
  const [content, setContent] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [jitterMinutes, setJitterMinutes] = useState(15);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  const groups = trpc.group.list.useQuery();
  const settings = trpc.setting.get.useQuery();
  const scan = trpc.group.requestCapabilityScan.useMutation();
  const create = trpc.campaign.createListing.useMutation();

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
      alert(body.error ?? `Upload failed (${res.status})`);
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

  // HEIC → JPEG conversion
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

  if (!groups.isLoading && listingGroups.length === 0) {
    return (
      <div className="rounded border border-amber-200 bg-amber-50 p-4">
        <p className="font-medium text-amber-900">No listing-capable groups yet.</p>
        <p className="mt-2 text-sm text-amber-800">
          Run a capability scan to detect which groups support Facebook Marketplace listings.
        </p>
        <button
          onClick={() => scan.mutate(undefined, { onSuccess: () => alert('Scan requested. Worker will open browser. Refresh shortly.') })}
          className="mt-3 rounded bg-amber-600 px-4 py-2 text-sm text-white"
          disabled={scan.isPending}
        >
          {scan.isPending ? 'Requesting…' : 'Run scan now'}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (selectedGroupIds.length === 0) { alert('Select at least one group.'); return; }
        if (mediaItems.length === 0) { alert('Upload at least one photo.'); return; }
        try {
          const result = await create.mutateAsync({
            listingKind, propertyType,
            bedrooms, bathrooms, priceBaht,
            squareMetres: typeof squareMetres === 'number' ? squareMetres : null,
            location, content,
            scheduledAt: new Date(scheduledAt),
            jitterMinutes,
            mediaFiles: mediaItems.map((m) => m.path),
            groupIds: selectedGroupIds,
          });
          onSaved?.(result.id);
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Failed to schedule listing');
        }
      }}
      className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]"
    >
      <div className="space-y-5">
        <section className="rounded border p-4">
          <h3 className="mb-3 font-semibold">Property details</h3>
          <div className="space-y-3">
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input type="radio" checked={listingKind === 'sale'} onChange={() => setListingKind('sale')} /> Sale
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={listingKind === 'rent'} onChange={() => setListingKind('rent')} /> Rent
              </label>
            </div>
            <div>
              <label className="block text-sm">Property type</label>
              <select value={propertyType} onChange={(e) => setPropertyType(e.target.value as PropertyType)} className="rounded border p-2">
                <option value="flat">Flat</option>
                <option value="house">House</option>
                <option value="townhouse">Townhouse</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">Bedrooms
                <input type="number" min={0} value={bedrooms} onChange={(e) => setBedrooms(Number(e.target.value))} className="mt-1 w-full rounded border p-2" />
              </label>
              <label className="text-sm">Bathrooms
                <input type="number" min={0} value={bathrooms} onChange={(e) => setBathrooms(Number(e.target.value))} className="mt-1 w-full rounded border p-2" />
              </label>
              <label className="text-sm">Price (฿)
                <input type="number" min={0} value={priceBaht} onChange={(e) => setPriceBaht(Number(e.target.value))} className="mt-1 w-full rounded border p-2" required />
              </label>
              <label className="text-sm">Square metres (optional)
                <input type="number" min={1} value={squareMetres} onChange={(e) => setSquareMetres(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 w-full rounded border p-2" />
              </label>
            </div>
          </div>
        </section>

        <section className="rounded border p-4">
          <h3 className="mb-3 font-semibold">Location</h3>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded border p-2" placeholder="e.g. Urban Property Udon, Udon Thani" required />
          <p className="mt-1 text-xs text-neutral-500">Worker will type this into Facebook and pick the first autocomplete suggestion.</p>
        </section>

        <section className="rounded border p-4">
          <h3 className="mb-3 font-semibold">Description</h3>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} required className="w-full rounded border p-2" />
        </section>

        <section className="rounded border p-4">
          <h3 className="mb-3 font-semibold">Photos (up to {MAX_PHOTOS_PER_LISTING})</h3>
          <label className="block cursor-pointer rounded border border-dashed p-4 text-center text-sm text-neutral-600">
            <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" className="hidden" onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ''; }} />
            Click to upload images
          </label>
          {mediaItems.length > 0 && (
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {mediaItems.map((it, i) => (
                <li key={it.path} className="relative overflow-hidden rounded border bg-neutral-100">
                  <div className="aspect-square w-full">
                    {it.isHeic && !it.previewUrl ? (
                      <div className="flex h-full items-center justify-center p-1 text-center text-2xs text-neutral-500">
                        {it.previewFailed ? 'HEIC preview unavailable' : 'Converting HEIC…'}
                      </div>
                    ) : (
                      <img src={it.previewUrl ?? it.url} alt={it.name} className="h-full w-full object-cover" loading="lazy" />
                    )}
                  </div>
                  <button type="button" onClick={() => removeMediaItem(i)} className="absolute right-1 top-1 rounded bg-black/50 p-1 text-white">✕</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded border p-4">
          <h3 className="mb-3 font-semibold">Schedule</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">Scheduled at
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required className="mt-1 w-full rounded border p-2" />
            </label>
            <label className="text-sm">Jitter (± minutes)
              <input type="number" min={0} max={120} value={jitterMinutes} onChange={(e) => setJitterMinutes(Number(e.target.value))} className="mt-1 w-full rounded border p-2" />
            </label>
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="rounded border p-4">
          <h3 className="mb-3 font-semibold">Target groups ({selectedGroupIds.length} selected)</h3>
          <div className="mb-2 flex gap-2">
            <button type="button" onClick={() => setSelectedGroupIds(listingGroups.map((g) => g.id))} className="text-xs text-blue-700 underline">Select all</button>
            <button type="button" onClick={() => setSelectedGroupIds([])} className="text-xs text-neutral-600 underline">Clear</button>
          </div>
          <div className="max-h-60 overflow-auto rounded border p-2 text-sm">
            {listingGroups.map((g) => (
              <label key={g.id} className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  checked={selectedGroupIds.includes(g.id)}
                  onChange={(e) => setSelectedGroupIds((prev) => e.target.checked ? [...prev, g.id] : prev.filter((id) => id !== g.id))}
                />
                <span className="truncate">{g.name ?? g.fbGroupId}</span>
              </label>
            ))}
          </div>
        </section>

        <BatchPreview
          selectedCount={selectedGroupIds.length}
          maxPerBatch={MAX_GROUPS_PER_BATCH}
          baseAt={baseAt}
          minDelayMinutes={minDelayMinutes}
          maxDelayMinutes={maxDelayMinutes}
        />

        <button type="submit" disabled={create.isPending} className="w-full rounded bg-green-600 px-4 py-2 text-white">
          {create.isPending ? 'Scheduling…' : 'Schedule listing'}
        </button>
        {create.error && <p className="text-sm text-red-600">{create.error.message}</p>}
      </aside>
    </form>
  );
}
