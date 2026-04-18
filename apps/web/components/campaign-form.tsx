'use client';
import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import type { MediaType } from '@app/shared';

export function CampaignForm({
  initial,
  campaignId,
  onSaved,
}: {
  initial?: { title?: string; content?: string; scheduledAt?: Date; recurrence?: string | null };
  campaignId?: string;
  onSaved?: (id: string) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [scheduledAt, setScheduledAt] = useState(
    initial?.scheduledAt ? initial.scheduledAt.toISOString().slice(0, 16) : '',
  );
  const [recurrence, setRecurrence] = useState(initial?.recurrence ?? '');
  const [jitterMinutes, setJitterMinutes] = useState(15);
  const [mediaType, setMediaType] = useState<MediaType>('none');
  const [mediaFiles, setMediaFiles] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  const groups = trpc.group.list.useQuery();
  const create = trpc.campaign.create.useMutation();

  async function uploadFiles(files: FileList) {
    // A campaignId pseudo — use temp id until saved; then real id backfills on create
    const tempId = campaignId ?? `temp-${Date.now()}`;
    const fd = new FormData();
    fd.append('campaignId', tempId);
    fd.append('kind', mediaType);
    Array.from(files).forEach((f) => fd.append('files', f));
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json() as { paths: string[] };
    setMediaFiles((prev) => [...prev, ...data.paths]);
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const result = await create.mutateAsync({
          title: title || undefined,
          content,
          mediaType,
          mediaFiles,
          scheduledAt: new Date(scheduledAt),
          recurrence: recurrence || null,
          jitterMinutes,
          groupIds: selectedGroupIds,
        });
        onSaved?.(result.id);
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-sm font-medium">Title (optional)</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded border p-2" />
      </div>

      <div>
        <label className="block text-sm font-medium">Content</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          required
          className="w-full rounded border p-2"
        />
      </div>

      <div className="flex gap-4">
        <div>
          <label className="block text-sm font-medium">Media type</label>
          <select
            value={mediaType}
            onChange={(e) => { setMediaType(e.target.value as MediaType); setMediaFiles([]); }}
            className="rounded border p-2"
          >
            <option value="none">None</option>
            <option value="images">Images (up to 10)</option>
            <option value="video">Video (1)</option>
          </select>
        </div>

        {mediaType !== 'none' && (
          <div>
            <label className="block text-sm font-medium">Upload</label>
            <input
              type="file"
              multiple={mediaType === 'images'}
              accept={mediaType === 'video' ? 'video/*' : 'image/*'}
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            />
            {mediaFiles.length > 0 && <p className="text-xs text-neutral-600">{mediaFiles.length} file(s) uploaded</p>}
          </div>
        )}
      </div>

      <div className="flex gap-4">
        <div>
          <label className="block text-sm font-medium">Scheduled at</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            required
            className="rounded border p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Recurrence (cron, optional)</label>
          <input
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value)}
            placeholder="0 9 * * MON"
            className="rounded border p-2 font-mono"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Jitter (± minutes)</label>
          <input
            type="number"
            min={0}
            max={120}
            value={jitterMinutes}
            onChange={(e) => setJitterMinutes(Number(e.target.value))}
            className="rounded border p-2 w-20"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Target groups ({selectedGroupIds.length} selected)</label>
        <div className="max-h-60 overflow-auto rounded border p-2">
          {groups.data?.filter((g) => g.isActive).map((g) => (
            <label key={g.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedGroupIds.includes(g.id)}
                onChange={(e) => {
                  setSelectedGroupIds((prev) =>
                    e.target.checked ? [...prev, g.id] : prev.filter((id) => id !== g.id),
                  );
                }}
              />
              <span>{g.name ?? g.fbGroupId}</span>
            </label>
          ))}
        </div>
      </div>

      <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white" disabled={create.isPending}>
        {create.isPending ? 'Saving...' : 'Schedule'}
      </button>
      {create.error && <p className="text-red-600 text-sm">{create.error.message}</p>}
    </form>
  );
}
