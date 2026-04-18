export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function pick(min: number, max: number): number {
  if (min > max) throw new Error(`humanDelay: min (${min}) > max (${max})`);
  const base = Math.random() * (max - min) + min;
  const jitter = 0.8 + Math.random() * 0.4;
  const v = base * jitter;
  return Math.max(min, Math.min(max, v));
}

export const humanDelay = Object.assign(
  async (min: number, max: number): Promise<number> => {
    const ms = pick(min, max);
    await sleep(ms);
    return ms;
  },
  { pick },
);
