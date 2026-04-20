'use client';
import { trpc } from '@/lib/trpc-client';
import Link from 'next/link';
import { useT } from '@/lib/i18n';

export function SessionBanner() {
  const status = trpc.session.status.useQuery();
  const t = useT();
  if (status.data?.valid) return null;

  return (
    <div
      className="mb-8 flex items-start gap-4 rounded-lg border border-line bg-raised p-4
                 shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--danger)_25%,transparent)]"
      role="alert"
    >
      <span
        aria-hidden
        className="mt-1 grid h-8 w-8 place-items-center rounded-full bg-[color-mix(in_oklch,var(--danger)_14%,transparent)] text-[var(--danger)]"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 4.5V8M7 10.2v.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="7" cy="7" r="5.8" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </span>
      <div className="flex-1">
        <h3 className="font-display text-base text-ink">{t('banner.title')}</h3>
        <p className="mt-1 text-sm text-ink-muted">{t('banner.desc')}</p>
      </div>
      <Link
        href="/session"
        className="inline-flex h-9 items-center rounded-md bg-[var(--danger)] px-4 text-sm font-medium
                   text-[var(--accent-ink)] transition hover:brightness-110"
      >
        {t('banner.cta')}
      </Link>
    </div>
  );
}
