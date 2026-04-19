import { describe, it, expect } from 'vitest';
import { batchSplit, scheduleForBatches } from './batching.js';

interface G { id: string }
const mk = (n: number): G[] => Array.from({ length: n }, (_, i) => ({ id: `g${i}` }));

describe('batchSplit', () => {
  it('returns single batch when input <= maxPerBatch', () => {
    const result = batchSplit(mk(5), 21);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(5);
  });

  it('returns single full batch at exactly maxPerBatch', () => {
    const result = batchSplit(mk(21), 21);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(21);
  });

  it('splits 22 into 21 + 1', () => {
    const result = batchSplit(mk(22), 21);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(21);
    expect(result[1]).toHaveLength(1);
  });

  it('splits 50 into 21 + 21 + 8 preserving input order', () => {
    const result = batchSplit(mk(50), 21);
    expect(result).toHaveLength(3);
    expect(result[0]!.map((g) => g.id)).toEqual(mk(21).map((g) => g.id));
    expect(result[1]!.map((g) => g.id)).toEqual(mk(21).map((_, i) => `g${i + 21}`));
    expect(result[2]!.map((g) => g.id)).toEqual(['g42', 'g43', 'g44', 'g45', 'g46', 'g47', 'g48', 'g49']);
  });

  it('returns empty array for empty input', () => {
    expect(batchSplit<G>([], 21)).toEqual([]);
  });

  it('throws if maxPerBatch <= 0', () => {
    expect(() => batchSplit(mk(5), 0)).toThrow();
  });
});

describe('scheduleForBatches', () => {
  const base = new Date('2026-04-19T10:00:00Z');

  it('returns empty array for count=0', () => {
    expect(scheduleForBatches(base, { count: 0, minDelayMs: 60_000, maxDelayMs: 120_000 })).toEqual([]);
  });

  it('first batch equals base for count=1', () => {
    const r = scheduleForBatches(base, { count: 1, minDelayMs: 60_000, maxDelayMs: 120_000 });
    expect(r).toHaveLength(1);
    expect(r[0]!.getTime()).toBe(base.getTime());
  });

  it('each subsequent batch is prev + uniform(min, max)', () => {
    const min = 30 * 60_000;
    const max = 60 * 60_000;
    const r = scheduleForBatches(base, { count: 5, minDelayMs: min, maxDelayMs: max });
    expect(r).toHaveLength(5);
    expect(r[0]!.getTime()).toBe(base.getTime());
    for (let i = 1; i < r.length; i++) {
      const diff = r[i]!.getTime() - r[i - 1]!.getTime();
      expect(diff).toBeGreaterThanOrEqual(min);
      expect(diff).toBeLessThanOrEqual(max);
    }
  });

  it('produces different schedules across runs (randomness present)', () => {
    const runs = Array.from({ length: 5 }, () =>
      scheduleForBatches(base, { count: 3, minDelayMs: 60_000, maxDelayMs: 3_600_000 }).map((d) => d.getTime()),
    );
    const signatures = new Set(runs.map((r) => r.join(',')));
    expect(signatures.size).toBeGreaterThan(1);
  });

  it('throws if minDelayMs > maxDelayMs', () => {
    expect(() => scheduleForBatches(base, { count: 3, minDelayMs: 1000, maxDelayMs: 500 })).toThrow();
  });
});
