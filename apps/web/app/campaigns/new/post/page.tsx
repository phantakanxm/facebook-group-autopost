'use client';
import Link from 'next/link';
import { CampaignForm } from '@/components/campaign-form';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/section';
import { useT } from '@/lib/i18n';

export default function NewPostCampaignPage() {
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
          eyebrow={t('new.post.eyebrow')}
          title={t('new.post.title')}
          subtitle={t('new.post.subtitle')}
        />
      </div>
      <CampaignForm
        {...(cloneFromId !== undefined && { cloneFromId })}
        onSaved={(id) => router.push(`/campaigns/${id}`)}
      />
    </div>
  );
}
