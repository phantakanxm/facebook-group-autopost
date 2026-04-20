'use client';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

type Mode = 'light' | 'dark';

function apply(mode: Mode) {
  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  localStorage.setItem('theme', mode);
}

function currentMode(): Mode {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<Mode>('light');

  useEffect(() => {
    setMode(currentMode());
  }, []);

  const toggle = () => {
    const next: Mode = mode === 'dark' ? 'light' : 'dark';
    apply(next);
    setMode(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
      className={cn(
        'group inline-flex h-8 w-[3.25rem] items-center rounded-full',
        'border border-line-strong bg-surface transition-colors duration-300',
        'hover:border-[var(--accent)]',
        className,
      )}
    >
      <span
        className={cn(
          'ml-0.5 flex h-7 w-7 items-center justify-center rounded-full',
          'bg-raised shadow-[0_1px_2px_rgb(0_0_0/0.08)]',
          'transition-transform duration-300 ease-out-expo',
          mode === 'dark' && 'translate-x-[1.375rem]',
        )}
      >
        {mode === 'dark' ? (
          /* Moon */
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path
              d="M11.5 8.5A5 5 0 0 1 5.5 2.5 5 5 0 1 0 11.5 8.5Z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
              className="text-[var(--accent)]"
            />
          </svg>
        ) : (
          /* Sun */
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
            <circle cx="7" cy="7" r="2.6" stroke="currentColor" strokeWidth="1.3" className="text-[var(--accent)]" />
            <g stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" className="text-[var(--accent)]">
              <path d="M7 1.2v1.6" />
              <path d="M7 11.2v1.6" />
              <path d="M1.2 7h1.6" />
              <path d="M11.2 7h1.6" />
              <path d="M2.8 2.8l1.1 1.1" />
              <path d="M10.1 10.1l1.1 1.1" />
              <path d="M2.8 11.2l1.1-1.1" />
              <path d="M10.1 3.9l1.1-1.1" />
            </g>
          </svg>
        )}
      </span>
    </button>
  );
}
