import { describe, it, expect } from 'vitest';
import { calculateNextRun, applyJitter } from './recurrence.js';

describe('applyJitter', () => {
  it('returns a date within ± jitterMinutes of base', () => {
    const base = new Date('2026-04-17T10:00:00Z');
    for (let i = 0; i < 50; i++) {
      const jittered = applyJitter(base, 15);
      const diffMin = Math.abs(jittered.getTime() - base.getTime()) / 60_000;
      expect(diffMin).toBeLessThanOrEqual(15);
    }
  });

  it('returns base when jitterMinutes is 0', () => {
    const base = new Date('2026-04-17T10:00:00Z');
    expect(applyJitter(base, 0).getTime()).toBe(base.getTime());
  });
});

describe('calculateNextRun', () => {
  it('returns null when recurrence is null (one-time)', () => {
    expect(calculateNextRun(new Date(), null)).toBeNull();
  });

  it('returns next Monday 09:00 for "0 9 * * MON"', () => {
    const from = new Date('2026-04-17T12:00:00Z'); // Friday
    const next = calculateNextRun(from, '0 9 * * MON');
    expect(next).not.toBeNull();
    expect(next!.getUTCDay()).toBe(1);
    expect(next!.getUTCHours()).toBe(9);
  });

  it('throws on invalid cron expression', () => {
    expect(() => calculateNextRun(new Date(), 'not a cron')).toThrow();
  });
});
