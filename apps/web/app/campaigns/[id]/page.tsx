'use client';
import { trpc } from '@/lib/trpc-client';
import { use } from 'react';

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const c = trpc.campaign.get.useQuery({ id });
  const resume = trpc.campaign.resume.useMutation({ onSuccess: () => c.refetch() });
  const cancel = trpc.campaign.cancel.useMutation({ onSuccess: () => c.refetch() });

  if (!c.data) return <p>Loading...</p>;
  const d = c.data;

  return (
    <main className="space-y-4">
      <h2 className="text-xl font-semibold">{d.title ?? 'Campaign'}</h2>
      <p>Status: <strong>{d.status}</strong></p>
      <p>Scheduled: {new Date(d.scheduledAt).toLocaleString()}</p>
      {d.lastError && <p className="text-red-700 text-sm">Last error: {d.lastError}</p>}

      <div className="flex gap-2">
        {d.status === 'paused' && (
          <button onClick={() => resume.mutate({ id })} className="rounded bg-green-600 px-4 py-2 text-white">
            Resume
          </button>
        )}
        {d.status !== 'completed' && d.status !== 'running' && (
          <button onClick={() => cancel.mutate({ id })} className="rounded bg-neutral-600 px-4 py-2 text-white">
            Cancel
          </button>
        )}
      </div>

      <div>
        <h3 className="font-semibold mt-4">Content</h3>
        <pre className="whitespace-pre-wrap rounded bg-neutral-100 p-2 text-sm">{d.content}</pre>
      </div>

      <div>
        <h3 className="font-semibold mt-4">Groups ({d.groups.length})</h3>
        <ul className="text-sm">
          {d.groups.map((cg) => (
            <li key={cg.groupId}>{cg.group.name ?? cg.group.fbGroupId}</li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="font-semibold mt-4">Logs ({d.logs.length})</h3>
        <table className="w-full text-sm">
          <thead><tr className="text-left"><th>Group</th><th>Status</th><th>Attempt</th><th>Error</th><th>Time</th></tr></thead>
          <tbody>
            {d.logs.map((l) => {
              const grp = d.groups.find((g) => g.groupId === l.groupId)?.group;
              return (
                <tr key={l.id} className="border-t">
                  <td>{grp?.name ?? grp?.fbGroupId}</td>
                  <td>{l.status}{l.note && ` (${l.note})`}</td>
                  <td>{l.attempt}</td>
                  <td className="text-red-700 truncate max-w-xs">{l.error}</td>
                  <td>{l.completedAt ? new Date(l.completedAt).toLocaleString() : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
