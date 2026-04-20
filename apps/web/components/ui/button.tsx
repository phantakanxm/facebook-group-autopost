'use client';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'ghost' | 'outline' | 'danger' | 'link';
type Size = 'sm' | 'md' | 'lg';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const base =
  'inline-flex items-center justify-center gap-2 font-medium rounded ' +
  'transition-[background,color,border-color,transform] duration-200 ease-out-quart ' +
  'disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.985] ' +
  'select-none whitespace-nowrap';

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-[15px]',
};

const variants: Record<Variant, string> = {
  primary:
    'bg-[var(--accent)] text-[var(--accent-ink)] border border-[var(--accent)] ' +
    'hover:brightness-110 shadow-sm',
  outline:
    'bg-transparent text-ink border border-line-strong ' +
    'hover:bg-surface hover:border-[var(--accent)] hover:text-[var(--accent)]',
  ghost:
    'bg-transparent text-ink-muted border border-transparent ' +
    'hover:text-ink hover:bg-surface',
  danger:
    'bg-transparent text-[var(--danger)] border border-line ' +
    'hover:bg-[color-mix(in_oklch,var(--danger)_10%,transparent)] hover:border-[var(--danger)]',
  link:
    'bg-transparent text-[var(--accent)] underline-offset-4 hover:underline ' +
    'h-auto px-0 border-0',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(base, variant !== 'link' && sizes[size], variants[variant], className)}
      {...rest}
    />
  );
});
