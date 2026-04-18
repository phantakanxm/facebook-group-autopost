import { describe, it, expect, vi } from 'vitest';
import { sleep, humanDelay } from './delays.js';

describe('sleep', () => {
  it('resolves after the given ms (monotonic)', async () => {
    const start = performance.now();
    await sleep(20);
    expect(performance.now() - start).toBeGreaterThanOrEqual(15);
  });
});

describe('humanDelay', () => {
  it('returns a value within [min, max] range', async () => {
    vi.useFakeTimers();
    const p = humanDelay(100, 200);
    vi.runAllTimers();
    const ms = await p;
    expect(ms).toBeGreaterThanOrEqual(100);
    expect(ms).toBeLessThanOrEqual(200);
    vi.useRealTimers();
  });

  it('distributes values across range (not constant)', () => {
    const samples = Array.from({ length: 200 }, () => humanDelay.pick(100, 500));
    const uniq = new Set(samples.map((v) => Math.round(v / 10)));
    expect(uniq.size).toBeGreaterThan(10);
  });

  it('throws if min > max', () => {
    expect(() => humanDelay.pick(500, 100)).toThrow();
  });
});
