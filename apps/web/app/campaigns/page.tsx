'use client';
import { trpc } from '@/lib/trpc-client';
import Link from 'next/link';
import { PageHeader, Surface, EmptyState } from '@/components/ui/section';
import { Button } from '@/components/ui/button';
import { Table, THead, TH, TRow, TD } from '@/components/ui/table';
import { CampaignStatus } from '@/components/ui/status-pill';
import { useT, useLocale } from '@/lib/i18n';

export default function CampaignsPage() {
  // Refresh every 5s so a running campaign's status/group count reflects
  // live worker progress without the user having to navigate away/back.
  const list = trpc.campaign.list.useQuery(undefined, { refetchInterval: 5000 });
  const t = useT();
  const { locale } = useLocale();
  const loc = locale === 'th' ? 'th-TH' : 'en-GB';

  return (
    <div className="space-y-10 animate-rise">
      <PageHeader
        eyebrow={t('camps.eyebrow')}
        title={t('camps.title')}
        subtitle={t('camps.subtitle')}
        actions={
          <Link href="/campaigns/new">
            <Button>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              {t('camps.new')}
            </Button>
          </Link>
        }
      />

      {!list.data ? (
        <Surface><p className="text-ink-muted">{t('common.loading')}</p></Surface>
      ) : list.data.length === 0 ? (
        <Surface>
          <EmptyState
            title={t('camps.empty.title')}
            description={t('camps.empty.desc')}
            action={
              <Link href="/campaigns/new">
                <Button variant="outline" size="sm">{t('camps.empty.cta')}</Button>
              </Link>
            }
          />
        </Surface>
      ) : (
        <Surface padded={false}>
          <Table>
            <THead>
              <tr>
                <TH className="pl-6">{t('camps.th.title')}</TH>
                <TH>{t('camps.th.status')}</TH>
                <TH>{t('camps.th.scheduled')}</TH>
                <TH align="right" className="pr-6">{t('camps.th.groups')}</TH>
              </tr>
            </THead>
            <tbody>
              {list.data.map((c) => {
                const date = new Date(c.scheduledAt);
                return (
                  <TRow key={c.id} interactive>
                    <TD className="pl-6">
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="group flex flex-col gap-1"
                      >
                        <span className="font-medium text-ink transition-colors group-hover:text-[var(--accent)]">
                          {c.title ?? c.content.slice(0, 48) + (c.content.length > 48 ? '…' : '')}
                        </span>
                        <span className="text-2xs text-ink-faint">{c.id.slice(0, 8)}</span>
                      </Link>
                    </TD>
                    <TD>
                      <CampaignStatus status={c.status} />
                    </TD>
                    <TD tabular muted>
                      <span className="text-ink">
                        {date.toLocaleDateString(loc, { day: '2-digit', month: 'short' })}
                      </span>
                      <span className="ml-2">
                        {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </span>
                    </TD>
                    <TD align="right" tabular className="pr-6">
                      <span className="editorial-num text-lg">
                        {/* Listing campaigns keep targets in batches[].groups; */}
                        {/* post campaigns use c.groups directly. */}
                        {c.groups.length > 0
                          ? c.groups.length
                          : c.batches?.reduce((sum, b) => sum + (b._count?.groups ?? 0), 0) ?? 0}
                      </span>
                    </TD>
                  </TRow>
                );
              })}
            </tbody>
          </Table>
        </Surface>
      )}
    </div>
  );
}
