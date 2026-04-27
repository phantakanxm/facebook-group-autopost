'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { Button } from './button';
import { useT } from '@/lib/i18n';

/* ================================================================== */
/* Types                                                               */
/* ================================================================== */

type ToastKind = 'success' | 'error' | 'info';
type ToastItem = {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
};

type ConfirmTone = 'primary' | 'danger';
export type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};
type ConfirmState = ConfirmOptions & {
  resolve: (ok: boolean) => void;
};

type LoadingState = { label: string } | null;

type FeedbackAPI = {
  toast: {
    success: (title: string, description?: string) => void;
    error: (title: string, description?: string) => void;
    info: (title: string, description?: string) => void;
  };
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  loading: {
    start: (label?: string) => void;
    stop: () => void;
    wrap: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
  };
};

/* ================================================================== */
/* Context & hooks                                                     */
/* ================================================================== */

const FeedbackContext = createContext<FeedbackAPI | null>(null);

export function useToast() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useToast must be used inside <FeedbackProvider>');
  return ctx.toast;
}

export function useConfirm() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useConfirm must be used inside <FeedbackProvider>');
  return ctx.confirm;
}

export function useLoading() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useLoading must be used inside <FeedbackProvider>');
  return ctx.loading;
}

/* ================================================================== */
/* Provider                                                            */
/* ================================================================== */

const TOAST_DURATION = 4200;

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>(null);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, title: string, description?: string) => {
      idRef.current += 1;
      const id = idRef.current;
      const item: ToastItem =
        description === undefined
          ? { id, kind, title }
          : { id, kind, title, description };
      setToasts((prev) => [...prev, item]);
      setTimeout(() => dismiss(id), TOAST_DURATION);
    },
    [dismiss],
  );

  const startLoading = useCallback((label?: string) => {
    setLoadingState({ label: label ?? '' });
  }, []);

  const stopLoading = useCallback(() => {
    setLoadingState(null);
  }, []);

  const wrapLoading = useCallback(
    async <T,>(label: string, fn: () => Promise<T>): Promise<T> => {
      setLoadingState({ label });
      try {
        return await fn();
      } finally {
        setLoadingState(null);
      }
    },
    [],
  );

  const api: FeedbackAPI = {
    toast: {
      success: (title, description) => push('success', title, description),
      error: (title, description) => push('error', title, description),
      info: (title, description) => push('info', title, description),
    },
    confirm: (opts) =>
      new Promise<boolean>((resolve) => {
        setConfirmState({ ...opts, resolve });
      }),
    loading: {
      start: startLoading,
      stop: stopLoading,
      wrap: wrapLoading,
    },
  };

  const handleConfirmClose = (ok: boolean) => {
    if (confirmState) {
      confirmState.resolve(ok);
      setConfirmState(null);
    }
  };

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      <ConfirmDialog state={confirmState} onClose={handleConfirmClose} />
      <LoadingOverlay state={loadingState} />
    </FeedbackContext.Provider>
  );
}

/* ================================================================== */
/* Toast viewport                                                      */
/* ================================================================== */

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-3 px-4',
        'sm:inset-x-auto sm:right-6 sm:top-6 sm:items-end',
      )}
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>,
    document.body,
  );
}

const TOAST_STYLES: Record<
  ToastKind,
  { icon: ReactNode; iconClass: string; label: string }
> = {
  success: {
    label: 'Success',
    iconClass:
      'bg-[color-mix(in_oklch,var(--positive)_14%,transparent)] text-[var(--positive)]',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
        <path
          d="M3 7.5L5.8 10 11 4.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  error: {
    label: 'Failed',
    iconClass:
      'bg-[color-mix(in_oklch,var(--danger)_14%,transparent)] text-[var(--danger)]',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
        <path
          d="M7 4.5V8M7 10.2v.1"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="7" cy="7" r="5.4" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
  info: {
    label: 'Notice',
    iconClass:
      'bg-[color-mix(in_oklch,var(--accent)_14%,transparent)] text-[var(--accent)]',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
        <circle cx="7" cy="7" r="5.4" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M7 6.2V10M7 4.1v.1"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
};

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const style = TOAST_STYLES[toast.kind];
  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-line',
        'bg-raised px-4 py-3.5 shadow-pop',
        'animate-[toast-in_0.35s_cubic-bezier(0.16,1,0.3,1)_both]',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full',
          style.iconClass,
        )}
      >
        {style.icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="small-caps text-ink-faint">{style.label}</span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="-mt-1 text-ink-faint transition-colors hover:text-ink"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path
                d="M3 3l6 6M9 3l-6 6"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="text-sm font-medium text-ink line-clamp-2">{toast.title}</div>
        {toast.description && (
          <div className="text-2xs text-ink-muted line-clamp-3">{toast.description}</div>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/* Confirm dialog                                                      */
/* ================================================================== */

function ConfirmDialog({
  state,
  onClose,
}: {
  state: ConfirmState | null;
  onClose: (ok: boolean) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const t = useT();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!state) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose(false);
        return;
      }
      if (e.key === 'Enter') {
        // Allow Enter on textarea / multiline inputs to flow normally if any
        const target = e.target as HTMLElement | null;
        if (target?.tagName === 'TEXTAREA') return;
        e.preventDefault();
        onClose(true);
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        const active = document.activeElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);

    // Focus the primary action shortly after mount (after autofocus settles)
    const focusTimer = window.setTimeout(() => {
      const primary = dialogRef.current?.querySelector<HTMLElement>('button[data-primary="true"]');
      primary?.focus();
    }, 0);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(focusTimer);
      // Restore previous focus
      previouslyFocused.current?.focus?.();
    };
  }, [state, onClose]);

  if (!mounted || !state) return null;

  const tone = state.tone ?? 'primary';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className={cn(
        'fixed inset-0 z-[70] flex items-center justify-center px-4',
        'animate-[fade-in_0.2s_ease-out_both]',
      )}
    >
      {/* backdrop */}
      <div
        onClick={() => onClose(false)}
        className={cn(
          'absolute inset-0',
          'bg-[color-mix(in_oklch,var(--ink)_55%,transparent)]',
          'backdrop-blur-[2px]',
        )}
        aria-hidden
      />

      {/* card */}
      <div
        ref={dialogRef}
        className={cn(
          'relative w-full max-w-md overflow-hidden rounded-xl border border-line bg-raised',
          'shadow-pop animate-[confirm-in_0.32s_cubic-bezier(0.16,1,0.3,1)_both]',
        )}
      >
        <div className="flex items-start gap-4 p-7">
          <span
            aria-hidden
            className={cn(
              'mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full',
              tone === 'danger'
                ? 'bg-[color-mix(in_oklch,var(--danger)_14%,transparent)] text-[var(--danger)]'
                : 'bg-accent-soft text-[var(--accent)]',
            )}
          >
            {tone === 'danger' ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path
                  d="M10 6.5V11M10 13.5v.1"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
                <path
                  d="M10 2.5L17.5 16h-15L10 2.5Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <circle
                  cx="10"
                  cy="10"
                  r="7.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M6.5 10l2.5 2.5L14 7.5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>

          <div className="flex-1">
            {state.eyebrow && (
              <div className="small-caps mb-2">{state.eyebrow}</div>
            )}
            <h3
              id="confirm-title"
              className="font-display text-xl tracking-editorial text-ink"
            >
              {state.title}
            </h3>
            {state.description && (
              <div className="mt-2 text-sm text-ink-muted">
                {state.description}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line bg-surface/60 px-7 py-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onClose(false)}
          >
            {state.cancelLabel ?? t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => onClose(true)}
            data-primary="true"
            className={cn(
              tone === 'danger' &&
                'bg-[var(--danger)] border-[var(--danger)] hover:brightness-110',
            )}
          >
            {state.confirmLabel ?? t('common.confirm')}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ================================================================== */
/* Loading overlay                                                     */
/* ================================================================== */

function LoadingOverlay({ state }: { state: LoadingState }) {
  const [mounted, setMounted] = useState(false);
  const t = useT();
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!state) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [state]);

  if (!mounted || !state) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'fixed inset-0 z-[80] flex items-center justify-center px-4',
        'animate-[fade-in_0.22s_ease-out_both]',
      )}
    >
      <div
        aria-hidden
        className={cn(
          'absolute inset-0',
          'bg-[color-mix(in_oklch,var(--ink)_58%,transparent)]',
          'backdrop-blur-[3px]',
        )}
      />

      <div
        className={cn(
          'relative flex flex-col items-center gap-6',
          'w-full max-w-[320px] rounded-xl border border-line bg-raised',
          'px-10 py-9 shadow-pop',
          'animate-[confirm-in_0.34s_cubic-bezier(0.16,1,0.3,1)_both]',
        )}
      >
        <Spinner />

        <div className="flex flex-col items-center gap-2 text-center">
          <span className="small-caps text-ink-faint">
            {t('common.processing')}
          </span>
          <span className="font-display text-lg leading-snug tracking-editorial text-ink">
            {state.label || t('common.pleaseWait')}
          </span>
          {state.label && (
            <span className="text-2xs text-ink-muted animate-[pulse-soft_1.6s_ease-in-out_infinite]">
              {t('common.pleaseWait')}
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Spinner() {
  return (
    <div className="relative h-12 w-12" aria-hidden>
      {/* Track */}
      <svg
        viewBox="0 0 48 48"
        className="absolute inset-0"
      >
        <circle
          cx="24"
          cy="24"
          r="19"
          stroke="var(--border-strong)"
          strokeOpacity="0.45"
          strokeWidth="2.5"
          fill="none"
        />
      </svg>
      {/* Rotating arc */}
      <svg
        viewBox="0 0 48 48"
        className="absolute inset-0 animate-[spin-smooth_1.15s_cubic-bezier(0.55,0.1,0.45,0.9)_infinite]"
      >
        <circle
          cx="24"
          cy="24"
          r="19"
          stroke="var(--accent)"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="40 200"
        />
      </svg>
      {/* Centre mark */}
      <span className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full bg-[var(--accent)] opacity-60" />
    </div>
  );
}
