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
