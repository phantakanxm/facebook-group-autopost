import { describe, it, expect } from 'vitest';
import { bezierPath } from './bezier.js';

describe('bezierPath', () => {
  it('starts at from and ends at to', () => {
    const points = bezierPath({ x: 10, y: 10 }, { x: 200, y: 300 }, 20);
    expect(points[0]).toEqual({ x: 10, y: 10 });
    expect(points.at(-1)).toEqual({ x: 200, y: 300 });
  });

  it('returns the requested number of points', () => {
    const points = bezierPath({ x: 0, y: 0 }, { x: 100, y: 100 }, 15);
    expect(points).toHaveLength(15);
  });

  it('has monotonic-ish progress (not reversing wildly)', () => {
    const points = bezierPath({ x: 0, y: 0 }, { x: 500, y: 500 }, 30);
    let inversions = 0;
    for (let i = 1; i < points.length; i++) {
      if (points[i]!.x < points[i - 1]!.x - 50) inversions++;
    }
    expect(inversions).toBeLessThan(3);
  });
});
