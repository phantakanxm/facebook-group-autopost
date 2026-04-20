import type { ReactNode, TableHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Table({
  className,
  ...rest
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table
        className={cn('w-full border-collapse text-sm', className)}
        {...rest}
      />
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>;
}

export function TRow({
  children,
  className,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <tr
      className={cn(
        'border-t border-line',
        interactive && 'transition-colors duration-150 hover:bg-surface',
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function TH({
  children,
  align = 'left',
  className,
}: {
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  return (
    <th
      className={cn(
        'small-caps pb-3 pt-0 font-semibold text-ink-faint',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TD({
  children,
  align = 'left',
  className,
  muted = false,
  tabular = false,
}: {
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
  muted?: boolean;
  tabular?: boolean;
}) {
  return (
    <td
      className={cn(
        'py-3.5 pr-4 align-middle',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        muted && 'text-ink-muted',
        tabular && 'tnum',
        className,
      )}
    >
      {children}
    </td>
  );
}
