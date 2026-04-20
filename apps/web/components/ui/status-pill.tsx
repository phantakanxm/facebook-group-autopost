import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'positive' | 'caution' | 'danger' | 'accent' | 'running';

const toneMap: Record<Tone, string> = {
  neutral:
    'bg-[color-mix(in_oklch,var(--ink)_7%,transparent)] text-ink',
  positive:
    'bg-[color-mix(in_oklch,var(--positive)_14%,transparent)] text-[var(--positive)]',
  caution:
    'bg-[color-mix(in_oklch,var(--caution)_16%,transparent)] text-[var(--caution)]',
  danger:
    'bg-[color-mix(in_oklch,var(--danger)_14%,transparent)] text-[var(--danger)]',
  accent:
    'bg-accent-soft text-[var(--accent)]',
  running:
    'bg-[color-mix(in_oklch,var(--accent)_18%,transparent)] text-[var(--accent)]',
};

const dotMap: Record<Tone, string> = {
  neutral: 'bg-ink-muted',
  positive: 'bg-[var(--positive)]',
  caution: 'bg-[var(--caution)]',
  danger: 'bg-[var(--danger)]',
  accent: 'bg-[var(--accent)]',
  running: 'bg-[var(--accent)]',
};

export function StatusPill({
  tone = 'neutral',
  dot = false,
  pulse = false,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5',
        'text-2xs font-semibold uppercase tracking-[0.1em]',
        'tnum',
        toneMap[tone],
        className,
      )}
    >
      {dot && (
        <span className="relative inline-flex h-1.5 w-1.5">
          {pulse && (
            <span
              className={cn(
                'absolute inset-0 rounded-full opacity-60 animate-ping',
                dotMap[tone],
              )}
            />
          )}
          <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', dotMap[tone])} />
        </span>
      )}
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, { tone: Tone; pulse?: boolean; dot?: boolean }> = {
  scheduled: { tone: 'neutral', dot: true },
  running:   { tone: 'running', dot: true, pulse: true },
  paused:    { tone: 'caution', dot: true },
  completed: { tone: 'positive', dot: true },
  failed:    { tone: 'danger', dot: true },
  cancelled: { tone: 'neutral', dot: true },
  success:   { tone: 'positive', dot: true },
  skipped:   { tone: 'caution', dot: true },
  retrying:  { tone: 'caution', dot: true, pulse: true },
  pending:   { tone: 'neutral', dot: true },
};

export function CampaignStatus({ status }: { status: string }) {
  const cfg = STATUS_TONES[status] ?? { tone: 'neutral' as const, dot: true };
  return (
    <StatusPill tone={cfg.tone} dot={cfg.dot ?? false} pulse={cfg.pulse ?? false}>
      {status}
    </StatusPill>
  );
}
