import { describe, it, expect } from 'vitest';
import { findFreePort } from './port';

describe('findFreePort', () => {
  it('returns a port number in the ephemeral range', async () => {
    const port = await findFreePort();
    expect(port).toBeGreaterThanOrEqual(1024);
    expect(port).toBeLessThan(65536);
  });

  it('returns distinct ports across calls', async () => {
    const [a, b] = await Promise.all([findFreePort(), findFreePort()]);
    expect(a).not.toBe(b);
  });
});
