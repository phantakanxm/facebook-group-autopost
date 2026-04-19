import { describe, it, expect } from 'vitest';
import { batchSplit } from './batching.js';

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
