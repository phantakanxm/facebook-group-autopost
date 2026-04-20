'use client';
import { trpc } from '@/lib/trpc-client';
import { PageHeader, Surface, EmptyState } from '@/components/ui/section';
import { Table, THead, TH, TRow, TD } from '@/components/ui/table';
import { StatusPill } from '@/components/ui/status-pill';
import { useT, useLocale } from '@/lib/i18n';

export default function LogsPage() {
  const logs = trpc.log.recent.useQuery({ limit: 200 });
  const t = useT();
  const { locale } = useLocale();
  const loc = locale === 'th' ? 'th-TH' : 'en-GB';

  return (
    <div className="space-y-10 animate-rise">
      <PageHeader
        eyebrow={t('logs.eyebrow')}
        title={t('logs.title')}
        subtitle={t('logs.subtitle')}
      />

      {!logs.data ? (
        <Surface><p className="text-ink-muted">{t('common.loading')}</p></Surface>
      ) : logs.data.length === 0 ? (
        <Surface>
          <EmptyState
            title={t('logs.empty.title')}
            description={t('logs.empty.desc')}
          />
        </Surface>
      ) : (
        <Surface padded={false}>
          <Table>
            <THead>
              <tr>
                <TH className="pl-6 w-[140px]">{t('logs.th.when')}</TH>
                <TH>{t('logs.th.campaign')}</TH>
                <TH>{t('logs.th.group')}</TH>
                <TH>{t('logs.th.result')}</TH>
                <TH align="right">{t('logs.th.attempt')}</TH>
                <TH className="pr-6">{t('logs.th.error')}</TH>
              </tr>
            </THead>
            <tbody>
              {logs.data.map((l) => {
                const d = new Date(l.createdAt);
                return (
                  <TRow key={l.id} interactive>
                    <TD className="pl-6" tabular muted>
                      <div className="flex flex-col leading-tight">
                        <span className="text-ink">
                          {d.toLocaleDateString(loc, { day: '2-digit', month: 'short' })}
                        </span>
                        <span className="text-2xs text-ink-faint">
                          {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>
                      </div>
                    </TD>
                    <TD>
                      <span className="font-medium text-ink">
                        {l.campaign.title ?? `#${l.campaignId.slice(0, 6)}`}
                      </span>
                    </TD>
                    <TD muted>
                      <span className="text-sm">{l.group.name ?? l.group.fbGroupId}</span>
                    </TD>
                    <TD>
                      <StatusPill
                        tone={
                          l.status === 'success'
                            ? 'positive'
                            : l.status === 'failed'
                              ? 'danger'
                              : l.status === 'skipped'
                                ? 'caution'
                                : 'neutral'
                        }
                        dot
                      >
                        {l.status}
                        {l.note && ` · ${l.note}`}
                      </StatusPill>
                    </TD>
                    <TD align="right" tabular>
                      {l.attempt}
                    </TD>
                    <TD className="pr-6 max-w-xs">
                      {l.error ? (
                        <span className="truncate font-mono text-2xs text-[var(--danger)]">
                          {l.error}
                        </span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
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
