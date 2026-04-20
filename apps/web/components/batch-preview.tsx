'use client';
import { Surface } from '@/components/ui/section';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/cn';

interface BatchPreviewProps {
  selectedCount: number;
  maxPerBatch: number;
  baseAt: Date | null;
  minDelayMinutes: number;
  maxDelayMinutes: number;
  locale?: string;
}

export function BatchPreview({
  selectedCount,
  maxPerBatch,
  baseAt,
  minDelayMinutes,
  maxDelayMinutes,
  locale,
}: BatchPreviewProps) {
  const t = useT();
  const loc = locale ?? 'en-GB';

  if (selectedCount === 0 || !baseAt) {
    return (
      <Surface>
        <p className="text-sm text-ink-muted">{t('batch.empty')}</p>
      </Surface>
    );
  }

  const fullBatches = Math.floor(selectedCount / maxPerBatch);
  const remainder = selectedCount % maxPerBatch;
  const batches: number[] = Array(fullBatches).fill(maxPerBatch);
  if (remainder > 0) batches.push(remainder);

  const avgDelay = (minDelayMinutes + maxDelayMinutes) / 2;

  const summaryKey = batches.length === 1 ? 'batch.summary.one' : 'batch.summary.many';

  return (
    <Surface padded={false}>
      <div className="px-5 pt-5 pb-3">
        <span className="small-caps">
          {t(summaryKey, { n: selectedCount, b: batches.length })}
        </span>
      </div>
      <div className="h-px bg-line" />
      <ul className="px-5 py-3">
        {batches.map((size, i) => {
          const approxMs = i * avgDelay * 60_000;
          const when = new Date(baseAt.getTime() + approxMs);
          const whenStr = when.toLocaleString(loc, {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: 'short',
          });
          const rowKey = size === 1 ? 'batch.row.one' : 'batch.row.many';
          return (
            <li
              key={i}
              className={cn(
                'flex items-center justify-between gap-3 py-2 text-sm',
                i > 0 && 'border-t border-line',
              )}
            >
              <span className="text-ink">
                {t(rowKey, { i: i + 1, n: size })}
              </span>
              <span className="tnum text-2xs text-ink-muted">
                {i === 0 ? whenStr : `~${whenStr}`}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="h-px bg-line" />
      <p className="px-5 py-3 text-2xs text-ink-faint">
        {t('batch.footer', { min: minDelayMinutes, max: maxDelayMinutes })}
      </p>
    </Surface>
  );
}
