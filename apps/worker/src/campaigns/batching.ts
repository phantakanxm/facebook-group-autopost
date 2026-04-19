export function batchSplit<T>(items: T[], maxPerBatch: number): T[][] {
  if (maxPerBatch <= 0) {
    throw new Error(`batchSplit: maxPerBatch must be > 0 (got ${maxPerBatch})`);
  }
  if (items.length === 0) return [];
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += maxPerBatch) {
    batches.push(items.slice(i, i + maxPerBatch));
  }
  return batches;
}

export interface ScheduleForBatchesOpts {
  count: number;
  minDelayMs: number;
  maxDelayMs: number;
}

export function scheduleForBatches(
  base: Date,
  opts: ScheduleForBatchesOpts,
): Date[] {
  if (opts.count <= 0) return [];
  if (opts.minDelayMs > opts.maxDelayMs) {
    throw new Error(
      `scheduleForBatches: minDelayMs (${opts.minDelayMs}) > maxDelayMs (${opts.maxDelayMs})`,
    );
  }

  const result: Date[] = [new Date(base.getTime())];
  for (let i = 1; i < opts.count; i++) {
    const prev = result[i - 1]!;
    const delay = Math.floor(
      opts.minDelayMs + Math.random() * (opts.maxDelayMs - opts.minDelayMs),
    );
    result.push(new Date(prev.getTime() + delay));
  }
  return result;
}
