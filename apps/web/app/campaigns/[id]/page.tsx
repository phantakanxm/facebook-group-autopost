'use client';
import { trpc } from '@/lib/trpc-client';
import { useRouter } from 'next/navigation';
import { use } from 'react';

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  // Poll while campaign might still be active so batch/log statuses refresh live.
  const c = trpc.campaign.get.useQuery({ id }, { refetchInterval: 5000 });
  const resume = trpc.campaign.resume.useMutation({ onSuccess: () => c.refetch() });
  const cancel = trpc.campaign.cancel.useMutation({ onSuccess: () => c.refetch() });

  if (!c.data) return <p>Loading...</p>;
  const d = c.data;
  const isListing = d.type === 'listing';

  return (
    <main className="space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <span className={`inline-block rounded px-2 py-0.5 text-2xs font-medium ${isListing ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
            {isListing ? 'Listing' : 'Post'}
          </span>
          <h2 className="mt-1 text-xl font-semibold">
            {isListing
              ? `${d.bedrooms}-bed ${d.propertyType ?? ''} — ฿${d.priceBaht?.toLocaleString() ?? ''}`
              : (d.title ?? 'Campaign')}
          </h2>
        </div>
        <p className="text-sm">Status: <strong>{d.status}</strong></p>
      </header>

      <p>Scheduled: {new Date(d.scheduledAt).toLocaleString()}</p>
      {d.lastError && <p className="rounded bg-red-50 p-2 text-sm text-red-700">Last error: {d.lastError}</p>}

      <div className="flex gap-2">
        {d.status === 'paused' && (
          <button onClick={() => resume.mutate({ id })} className="rounded bg-green-600 px-4 py-2 text-white">Resume</button>
        )}
        {d.status !== 'completed' && d.status !== 'failed' && (
          <button
            onClick={() => {
              if (d.status === 'running') {
                const ok = confirm(
                  'Campaign is currently running. Cancel will stop future groups/batches. The group FB is posting to RIGHT NOW will finish. Continue?',
                );
                if (!ok) return;
              }
              cancel.mutate({ id });
            }}
            className={`rounded px-4 py-2 text-white ${d.status === 'running' ? 'bg-red-600' : 'bg-neutral-600'}`}
          >
            {d.status === 'running' ? 'Cancel running' : 'Cancel'}
          </button>
        )}
        <button
          onClick={() => router.push(`/campaigns/new/${isListing ? 'listing' : 'post'}?from=${id}`)}
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          Duplicate
        </button>
      </div>

      {isListing && (
        <section className="rounded border p-3">
          <h3 className="mb-2 font-semibold">Property</h3>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-neutral-600">Kind</dt><dd>{d.listingKind}</dd>
            <dt className="text-neutral-600">Type</dt><dd>{d.propertyType}</dd>
            <dt className="text-neutral-600">Bedrooms</dt><dd>{d.bedrooms}</dd>
            <dt className="text-neutral-600">Bathrooms</dt><dd>{d.bathrooms}</dd>
            <dt className="text-neutral-600">Price</dt><dd>฿{d.priceBaht?.toLocaleString()}</dd>
            {d.squareMetres != null && (<><dt className="text-neutral-600">Sq.m</dt><dd>{d.squareMetres}</dd></>)}
            <dt className="text-neutral-600">Location</dt><dd>{d.location}</dd>
          </dl>
        </section>
      )}

      <section>
        <h3 className="font-semibold">Description</h3>
        <pre className="whitespace-pre-wrap rounded bg-neutral-100 p-2 text-sm">{d.content}</pre>
      </section>

      {isListing ? (
        <section>
          <h3 className="font-semibold">Batches ({d.batches?.length ?? 0})</h3>
          <ul className="space-y-2 text-sm">
            {d.batches?.map((b) => {
              const primary = b.groups.find((g) => g.isPrimary);
              const shares = b.groups.filter((g) => !g.isPrimary);
              return (
                <li key={b.id} className="rounded border p-3">
                  <div className="flex items-center justify-between">
                    <strong>Batch {b.order}</strong>
                    <span className={`rounded px-2 py-0.5 text-2xs font-medium ${
                      b.status === 'completed' ? 'bg-green-100 text-green-800'
                      : b.status === 'running' ? 'bg-blue-100 text-blue-800'
                      : b.status === 'failed' ? 'bg-red-100 text-red-800'
                      : b.status === 'skipped' ? 'bg-neutral-200 text-neutral-700'
                      : 'bg-amber-100 text-amber-800'
                    }`}>{b.status}</span>
                  </div>
                  <p className="mt-1 text-neutral-600">
                    {new Date(b.scheduledAt).toLocaleString()} · {b.groups.length} groups
                    {primary && <> · primary: {primary.group.name ?? primary.group.fbGroupId}</>}
                  </p>
                  {shares.length > 0 && (
                    <p className="mt-1 truncate text-xs text-neutral-500">
                      Share: {shares.map((s) => s.group.name ?? s.group.fbGroupId).join(', ')}
                    </p>
                  )}
                  {b.lastError && <p className="mt-1 text-xs text-red-700">{b.lastError}</p>}
                  {b.fbPostUrl && (
                    <a href={b.fbPostUrl} target="_blank" className="mt-1 block text-xs text-blue-700">{b.fbPostUrl}</a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <section>
          <h3 className="font-semibold">Groups ({d.groups.length})</h3>
          <ul className="text-sm">
            {d.groups.map((cg) => (<li key={cg.groupId}>{cg.group.name ?? cg.group.fbGroupId}</li>))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="font-semibold">Logs ({d.logs.length})</h3>
        <table className="w-full text-sm">
          <thead><tr className="text-left"><th>Group</th><th>Status</th><th>Attempt</th><th>Error</th><th>Time</th></tr></thead>
          <tbody>
            {d.logs.map((l) => {
              // Listing campaigns populate d.batches[].groups; regular campaigns use d.groups.
              // Check both so the Group column renders for either flavor.
              const grp =
                d.groups.find((g) => g.groupId === l.groupId)?.group ??
                d.batches?.flatMap((b) => b.groups).find((g) => g.groupId === l.groupId)?.group;
              return (
                <tr key={l.id} className="border-t">
                  <td>{grp?.name ?? grp?.fbGroupId}</td>
                  <td>{l.status}{l.note && ` (${l.note})`}</td>
                  <td>{l.attempt}</td>
                  <td className="max-w-xs truncate text-red-700">{l.error}</td>
                  <td>{l.completedAt ? new Date(l.completedAt).toLocaleString() : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
