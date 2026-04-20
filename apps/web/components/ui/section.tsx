import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex items-end justify-between gap-6 pb-6', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="small-caps mb-3">{eyebrow}</div>}
        <h1 className="font-display text-[clamp(2rem,2.6vw+1.2rem,3.25rem)] font-[500] leading-[1.05] tracking-editorial">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 max-w-[62ch] text-ink-muted">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-4 pb-3', className)}>
      <div className="flex items-baseline gap-3">
        {eyebrow && (
          <span className="small-caps shrink-0">{eyebrow}</span>
        )}
        <h2 className="font-display text-xl tracking-editorial">{title}</h2>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Surface({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-line bg-raised',
        padded && 'p-6',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-line', className)} />;
}

export function Metric({
  label,
  value,
  helper,
  tone = 'default',
}: {
  label: ReactNode;
  value: ReactNode;
  helper?: ReactNode;
  tone?: 'default' | 'accent';
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="small-caps">{label}</div>
      <div
        className={cn(
          'editorial-num text-[clamp(2.2rem,2.6vw+1rem,3.4rem)] leading-[0.95]',
          tone === 'accent' ? 'text-[var(--accent)]' : 'text-ink',
        )}
      >
        {value}
      </div>
      {helper && <div className="text-sm text-ink-muted">{helper}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 py-10">
      <div className="small-caps text-ink-faint">Empty</div>
      <div className="font-display text-lg text-ink">{title}</div>
      {description && <p className="max-w-[52ch] text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
