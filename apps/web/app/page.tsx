'use client';
import { trpc } from '@/lib/trpc-client';
import Link from 'next/link';

export default function DashboardPage() {
  const s = trpc.dashboard.summary.useQuery();
  if (!s.data) return <p>Loading…</p>;
  const d = s.data;
  return (
    <main className="space-y-6">
      <section className="grid grid-cols-3 gap-4">
        <div className="rounded border p-4">
          <h3 className="font-semibold">Session</h3>
          <p className={d.session.valid ? 'text-green-700' : 'text-red-700'}>
            {d.session.valid ? 'Valid' : 'Invalid'}
          </p>
        </div>
        <div className="rounded border p-4">
          <h3 className="font-semibold">Running</h3>
          {d.running ? (
            <Link href={`/campaigns/${d.running.id}`} className="text-blue-700">
              {d.running.title ?? d.running.id.slice(0, 6)}
            </Link>
          ) : <p>None</p>}
        </div>
        <div className="rounded border p-4">
          <h3 className="font-semibold">Paused</h3>
          <p>{d.pausedCount}</p>
        </div>
      </section>

      <section>
        <h3 className="font-semibold">Upcoming (7 days)</h3>
        <ul>
          {d.upcoming.map((c) => (
            <li key={c.id}>
              <Link href={`/campaigns/${c.id}`} className="text-blue-700">{c.title ?? c.id.slice(0, 6)}</Link>
              {' — '}{new Date(c.scheduledAt).toLocaleString()}
            </li>
          ))}
          {d.upcoming.length === 0 && <li className="text-neutral-500">None scheduled</li>}
        </ul>
      </section>

      <section>
        <h3 className="font-semibold">Recent activity (7 days)</h3>
        <p>
          Success: {d.recent.success} · Failed/Skipped: {d.recent.failed}
          {d.recent.successRate !== null && ` · Success rate: ${(d.recent.successRate * 100).toFixed(1)}%`}
        </p>
      </section>
    </main>
  );
}
