'use client';
import { trpc } from '@/lib/trpc-client';

export default function LogsPage() {
  const logs = trpc.log.recent.useQuery({ limit: 200 });
  return (
    <main>
      <h2 className="text-xl font-semibold">Logs (last 200)</h2>
      <table className="mt-2 w-full text-sm">
        <thead><tr className="text-left">
          <th>Time</th><th>Campaign</th><th>Group</th><th>Status</th><th>Attempt</th><th>Error</th>
        </tr></thead>
        <tbody>
          {logs.data?.map((l) => (
            <tr key={l.id} className="border-t">
              <td>{new Date(l.createdAt).toLocaleString()}</td>
              <td>{l.campaign.title ?? l.campaignId.slice(0, 6)}</td>
              <td>{l.group.name ?? l.group.fbGroupId}</td>
              <td>{l.status}{l.note && ` (${l.note})`}</td>
              <td>{l.attempt}</td>
              <td className="max-w-xs truncate text-red-700">{l.error}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
