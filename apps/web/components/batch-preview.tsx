'use client';

interface BatchPreviewProps {
  selectedCount: number;
  maxPerBatch: number;
  baseAt: Date | null;
  minDelayMinutes: number;
  maxDelayMinutes: number;
}

export function BatchPreview({
  selectedCount,
  maxPerBatch,
  baseAt,
  minDelayMinutes,
  maxDelayMinutes,
}: BatchPreviewProps) {
  if (selectedCount === 0 || !baseAt) {
    return (
      <p className="text-sm text-neutral-500">Select target groups and schedule time to see batches.</p>
    );
  }
  const fullBatches = Math.floor(selectedCount / maxPerBatch);
  const remainder = selectedCount % maxPerBatch;
  const batches: number[] = Array(fullBatches).fill(maxPerBatch);
  if (remainder > 0) batches.push(remainder);

  const avgDelay = (minDelayMinutes + maxDelayMinutes) / 2;

  return (
    <div className="rounded border border-neutral-200 bg-neutral-50 p-3 text-sm">
      <p className="font-medium">
        {selectedCount} selected → {batches.length} batch{batches.length > 1 ? 'es' : ''}
      </p>
      <ul className="mt-2 space-y-1">
        {batches.map((size, i) => {
          const approxMs = i * avgDelay * 60_000;
          const when = new Date(baseAt.getTime() + approxMs);
          return (
            <li key={i} className="flex items-center justify-between gap-3">
              <span>Batch {i}: {size} group{size > 1 ? 's' : ''}</span>
              <span className="text-neutral-500 tnum">
                {i === 0
                  ? when.toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
                  : `~${when.toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}`}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-neutral-500">
        Delay {minDelayMinutes}-{maxDelayMinutes} min between batches. Change in Settings.
      </p>
    </div>
  );
}
