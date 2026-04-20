'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode, SVGProps } from 'react';
import { cn } from '@/lib/cn';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LocaleToggle } from '@/components/ui/locale-toggle';
import { trpc } from '@/lib/trpc-client';
import { useT, type TranslationKey } from '@/lib/i18n';

/* ------------------------------------------------------------------ */

type NavItem = {
  href: string;
  labelKey: TranslationKey;
  hintKey: TranslationKey;
  icon: (p: SVGProps<SVGSVGElement>) => ReactNode;
  match?: RegExp;
};

const icon = (d: string) => (p: SVGProps<SVGSVGElement>) =>
  (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden {...p}>
      <path d={d} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

const NAV: NavItem[] = [
  {
    href: '/',
    labelKey: 'nav.dashboard',
    hintKey: 'nav.dashboard.hint',
    match: /^\/$/,
    icon: icon('M2 8.5L8 3l6 5.5M3.5 7.5v6h9v-6'),
  },
  {
    href: '/campaigns',
    labelKey: 'nav.campaigns',
    hintKey: 'nav.campaigns.hint',
    match: /^\/campaigns/,
    icon: icon('M3.5 2.5h7l2.5 2.5v8.5h-9.5zM10 2.5v3h3M5.5 8h5M5.5 10.5h3.5'),
  },
  {
    href: '/groups',
    labelKey: 'nav.groups',
    hintKey: 'nav.groups.hint',
    match: /^\/groups/,
    icon: icon('M5.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM11 7a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2ZM2 13.5c0-2.2 1.6-3.5 3.5-3.5s3.5 1.3 3.5 3.5M14 13.5c0-1.6-1-2.8-2.5-3.1'),
  },
  {
    href: '/logs',
    labelKey: 'nav.activity',
    hintKey: 'nav.activity.hint',
    match: /^\/logs/,
    icon: icon('M2.5 3h11M2.5 6h11M2.5 9h8M2.5 12h5'),
  },
  {
    href: '/settings',
    labelKey: 'nav.settings',
    hintKey: 'nav.settings.hint',
    match: /^\/settings/,
    icon: icon('M8 10.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6ZM13.2 8c0 .5-.06.95-.17 1.4l1.24.97-1.5 2.6-1.47-.6c-.7.53-1.52.93-2.4 1.13L8.6 15h-1.2l-.3-1.5a5.3 5.3 0 0 1-2.4-1.13l-1.47.6-1.5-2.6 1.24-.97A5.8 5.8 0 0 1 2.8 8c0-.48.06-.95.17-1.4L1.73 5.63l1.5-2.6 1.47.6c.7-.53 1.52-.93 2.4-1.13L7.4 1h1.2l.3 1.5c.88.2 1.7.6 2.4 1.13l1.47-.6 1.5 2.6-1.24.97c.1.45.17.92.17 1.4Z'),
  },
  {
    href: '/session',
    labelKey: 'nav.session',
    hintKey: 'nav.session.hint',
    match: /^\/session/,
    icon: icon('M8 8a2.6 2.6 0 1 0 0-5.2A2.6 2.6 0 0 0 8 8ZM2.5 14c.6-2.2 2.8-3.6 5.5-3.6s4.9 1.4 5.5 3.6'),
  },
];

/* ------------------------------------------------------------------ */

function SessionIndicator() {
  const status = trpc.session.status.useQuery();
  const valid = status.data?.valid ?? false;
  const t = useT();

  return (
    <Link
      href="/session"
      className={cn(
        'flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2.5',
        'transition-colors hover:border-line-strong',
      )}
    >
      <span
        className={cn(
          'relative inline-flex h-2 w-2 rounded-full',
          valid ? 'bg-[var(--positive)]' : 'bg-[var(--danger)]',
        )}
      >
        {valid && (
          <span className="absolute inset-0 animate-ping rounded-full bg-[var(--positive)] opacity-50" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="small-caps text-ink-faint">{t('shell.session.eyebrow')}</span>
        <span className={cn('truncate text-xs font-medium', valid ? 'text-ink' : 'text-[var(--danger)]')}>
          {valid ? t('shell.session.active') : t('shell.session.invalid')}
        </span>
      </span>
    </Link>
  );
}

/* ------------------------------------------------------------------ */

function Logo() {
  const t = useT();
  return (
    <div className="flex items-center gap-3 px-1">
      <span
        aria-hidden
        className={cn(
          'relative grid h-9 w-9 place-items-center',
          'rounded-[10px] bg-[var(--accent)] text-[var(--accent-ink)]',
          'shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--ink)_12%,transparent)]',
        )}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M2 3h12v7.5l-3.5-2.5H2V3Z"
            fill="currentColor"
            opacity="0.95"
          />
          <path d="M5.5 6h5" stroke="var(--accent)" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      </span>
      <div className="flex flex-col leading-none">
        <span className="font-display text-[15px] font-[500] tracking-[-0.01em] text-ink">
          {t('brand.name')}
        </span>
        <span className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          {t('brand.tagline')}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const t = useT();

  return (
    <div className="flex min-h-screen">
      {/* ---------- Sidebar ---------- */}
      <aside
        className={cn(
          'sticky top-0 z-20 hidden h-screen w-[260px] shrink-0',
          'border-r border-line bg-surface/70 backdrop-blur-sm',
          'md:flex md:flex-col',
        )}
      >
        <div className="flex h-20 items-center px-5">
          <Logo />
        </div>

        <div className="px-3">
          <div className="rule" />
        </div>

        <nav className="flex flex-col gap-0.5 px-3 py-5">
          {NAV.map((item) => {
            const active = item.match ? item.match.test(pathname) : pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm',
                  'transition-colors duration-200 ease-out-quart',
                  active
                    ? 'bg-raised text-ink'
                    : 'text-ink-muted hover:bg-raised/60 hover:text-ink',
                )}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 -translate-x-3 rounded-full bg-[var(--accent)]"
                  />
                )}
                <span
                  className={cn(
                    'transition-colors',
                    active ? 'text-[var(--accent)]' : 'text-ink-faint group-hover:text-ink-muted',
                  )}
                >
                  <item.icon />
                </span>
                <span className="flex-1 font-medium">{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-3 border-t border-line p-4">
          <SessionIndicator />
          <div className="flex items-center justify-between px-1">
            <span className="small-caps">{t('shell.language')}</span>
            <LocaleToggle />
          </div>
          <div className="flex items-center justify-between px-1">
            <span className="small-caps">{t('shell.appearance')}</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* ---------- Main ---------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-line bg-paper/80 px-5 backdrop-blur-sm md:hidden">
          <Logo />
          <div className="flex items-center gap-2">
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-6 py-10 md:px-10 md:py-14 lg:px-14">
          <div className="mx-auto w-full max-w-[1180px]">
            {children}
          </div>
        </main>

        <footer className="border-t border-line px-6 py-6 text-center md:px-10">
          <p className="text-2xs uppercase tracking-[0.18em] text-ink-faint">
            {t('shell.footer.a')} · <span className="text-ink-muted">{t('shell.footer.b')}</span>
          </p>
        </footer>
      </div>
    </div>
  );
}
