export interface Point { x: number; y: number; }

export function bezierPath(from: Point, to: Point, steps: number): Point[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const perpX = -dy / (dist || 1);
  const perpY = dx / (dist || 1);
  const bow = (Math.random() - 0.5) * Math.min(dist * 0.25, 80);

  const c1: Point = {
    x: from.x + dx * 0.25 + perpX * bow,
    y: from.y + dy * 0.25 + perpY * bow,
  };
  const c2: Point = {
    x: from.x + dx * 0.75 + perpX * bow * 0.6,
    y: from.y + dy * 0.75 + perpY * bow * 0.6,
  };

  const points: Point[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const mt = 1 - t;
    const x = mt ** 3 * from.x + 3 * mt ** 2 * t * c1.x + 3 * mt * t ** 2 * c2.x + t ** 3 * to.x;
    const y = mt ** 3 * from.y + 3 * mt ** 2 * t * c1.y + 3 * mt * t ** 2 * c2.y + t ** 3 * to.y;
    points.push({ x: Math.round(x), y: Math.round(y) });
  }
  return points;
}
