'use client';
import { trpc } from '@/lib/trpc-client';
import Link from 'next/link';

export default function CampaignsPage() {
  const list = trpc.campaign.list.useQuery();
  return (
    <main>
      <div className="mb-4 flex justify-between">
        <h2 className="text-xl font-semibold">Campaigns</h2>
        <Link href="/campaigns/new" className="rounded bg-blue-600 px-4 py-2 text-white">New</Link>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left"><th>Title</th><th>Status</th><th>Scheduled</th><th>Groups</th></tr></thead>
        <tbody>
          {list.data?.map((c) => (
            <tr key={c.id} className="border-t">
              <td><Link href={`/campaigns/${c.id}`} className="text-blue-700">{c.title ?? c.content.slice(0, 40)}</Link></td>
              <td>{c.status}</td>
              <td>{new Date(c.scheduledAt).toLocaleString()}</td>
              <td>{c.groups.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
