'use client';
import {
  forwardRef,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';

const inputBase =
  'w-full bg-transparent text-ink placeholder:text-ink-faint ' +
  'border border-line-strong rounded-md px-3 py-2 text-sm ' +
  'transition-[border-color,background,box-shadow] duration-200 ' +
  'hover:border-ink-muted ' +
  'focus:outline-none focus:border-[var(--accent)] ' +
  'focus:shadow-[0_0_0_3px_var(--ring)] ' +
  'disabled:opacity-50';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(inputBase, className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(inputBase, 'resize-y leading-relaxed', className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(inputBase, 'appearance-none pr-9 cursor-pointer', className)}
          {...rest}
        >
          {children}
        </select>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
          width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden
        >
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
    );
  },
);

export function Label({
  children,
  hint,
  required = false,
  className,
}: {
  children: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('mb-1.5 flex items-baseline justify-between gap-3', className)}>
      <label className="small-caps">
        {children}
        {required && <span className="ml-1 text-[var(--accent)]">*</span>}
      </label>
      {hint && <span className="text-2xs text-ink-faint">{hint}</span>}
    </div>
  );
}

export function Field({
  label,
  hint,
  required = false,
  helper,
  error,
  children,
  className,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  helper?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col', className)}>
      {label && <Label hint={hint} required={required}>{label}</Label>}
      {children}
      {error && <p className="mt-1.5 text-2xs text-[var(--danger)]">{error}</p>}
      {!error && helper && <p className="mt-1.5 text-2xs text-ink-faint">{helper}</p>}
    </div>
  );
}
