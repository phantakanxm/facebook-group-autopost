'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ListingForm } from '@/components/listing-form';
import { PageHeader } from '@/components/ui/section';
import { useT } from '@/lib/i18n';

function NewListingCampaignContent() {
  const router = useRouter();
  const t = useT();
  const searchParams = useSearchParams();
  const cloneFromId = searchParams.get('from') ?? undefined;

  return (
    <div className="space-y-10 animate-rise">
      <div>
        <Link
          href="/campaigns/new"
          className="mb-6 inline-flex items-center gap-1.5 text-2xs uppercase tracking-[0.14em] text-ink-faint transition-colors hover:text-[var(--accent)]"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
            <path d="M6 2L3 5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t('picker.eyebrow')}
        </Link>
        <PageHeader
          eyebrow={t('new.listing.eyebrow')}
          title={t('new.listing.title')}
          subtitle={t('new.listing.subtitle')}
        />
      </div>
      <ListingForm
        {...(cloneFromId !== undefined && { cloneFromId })}
        onSaved={(id) => router.push(`/campaigns/${id}`)}
      />
    </div>
  );
}

export default function NewListingCampaignPage() {
  return (
    <Suspense>
      <NewListingCampaignContent />
    </Suspense>
  );
}
