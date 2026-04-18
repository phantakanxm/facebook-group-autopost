import * as cronParser from 'cron-parser';

export function applyJitter(base: Date, jitterMinutes: number): Date {
  if (jitterMinutes === 0) return base;
  const offsetMs = (Math.random() * 2 - 1) * jitterMinutes * 60_000;
  return new Date(base.getTime() + offsetMs);
}

export function calculateNextRun(from: Date, recurrence: string | null): Date | null {
  if (recurrence === null || recurrence === '') return null;
  const interval = cronParser.parseExpression(recurrence, { currentDate: from, utc: true });
  return interval.next().toDate();
}
