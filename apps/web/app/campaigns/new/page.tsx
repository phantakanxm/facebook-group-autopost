'use client';
import Link from 'next/link';
import { PageHeader, Surface } from '@/components/ui/section';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/cn';

export default function NewCampaignTypePicker() {
  const t = useT();

  return (
    <div className="space-y-10 animate-rise">
      <PageHeader
        eyebrow={t('picker.eyebrow')}
        title={t('picker.title')}
        subtitle={t('picker.subtitle')}
      />

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <PickerCard
          href="/campaigns/new/post"
          eyebrow={t('picker.post.eyebrow')}
          title={t('picker.post.title')}
          description={t('picker.post.desc')}
          cta={t('picker.post.cta')}
          iconKind="post"
          className="animate-rise animate-rise-1"
        />
        <PickerCard
          href="/campaigns/new/listing"
          eyebrow={t('picker.listing.eyebrow')}
          title={t('picker.listing.title')}
          description={t('picker.listing.desc')}
          cta={t('picker.listing.cta')}
          iconKind="listing"
          className="animate-rise animate-rise-2"
        />
      </section>
    </div>
  );
}

function PickerCard({
  href,
  eyebrow,
  title,
  description,
  cta,
  iconKind,
  className,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  iconKind: 'post' | 'listing';
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex flex-col gap-5 rounded-lg border border-line bg-raised p-7',
        'transition-all duration-300 ease-out-quart',
        'hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-raise',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <span
          aria-hidden
          className="grid h-11 w-11 place-items-center rounded-md bg-accent-soft text-[var(--accent)]"
        >
          {iconKind === 'post' ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M4 4.5h9l3 3V16H4V4.5ZM13 4.5v3h3M7 10h6M7 12.5h4"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M3.5 9L10 3.5 16.5 9M5 7.5V16h10V7.5M8.5 16v-4.5h3V16"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
        <span className="small-caps">{eyebrow}</span>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="font-display text-2xl leading-tight tracking-editorial text-ink">
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-ink-muted">{description}</p>
      </div>

      <div className="mt-auto flex items-center gap-2 text-sm font-medium text-[var(--accent)]">
        {cta}
        <svg
          className="transition-transform duration-200 ease-out-quart group-hover:translate-x-0.5"
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden
        >
          <path
            d="M4 3l4 4-4 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </Link>
  );
}
