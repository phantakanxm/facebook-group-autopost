'use client';
import { useLocale, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/cn';

const OPTIONS: Array<{ value: Locale; label: string }> = [
  { value: 'en', label: 'EN' },
  { value: 'th', label: 'TH' },
];

export function LocaleToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();

  return (
    <div
      role="tablist"
      aria-label="Language"
      className={cn(
        'relative inline-flex h-8 items-center rounded-full border border-line-strong bg-surface p-0.5',
        className,
      )}
    >
      {OPTIONS.map((opt) => {
        const active = locale === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setLocale(opt.value)}
            className={cn(
              'relative z-10 grid h-7 w-9 place-items-center rounded-full',
              'text-[11px] font-semibold uppercase tracking-[0.12em]',
              'transition-colors duration-200 ease-out-quart',
              active
                ? 'text-[var(--accent-ink)]'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {active && (
              <span
                aria-hidden
                className="absolute inset-0 -z-10 rounded-full bg-[var(--accent)]"
              />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
