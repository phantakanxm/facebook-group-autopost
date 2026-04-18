'use client';
import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';

export default function GroupsPage() {
  const list = trpc.group.list.useQuery();
  const bulk = trpc.group.bulkCreate.useMutation({ onSuccess: () => list.refetch() });
  const setActive = trpc.group.setActive.useMutation({ onSuccess: () => list.refetch() });
  const remove = trpc.group.remove.useMutation({ onSuccess: () => list.refetch() });

  const [urls, setUrls] = useState('');

  return (
    <main className="space-y-6">
      <section>
        <h2 className="text-xl font-semibold">Add Groups (paste one URL per line)</h2>
        <textarea
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          rows={5}
          placeholder="https://www.facebook.com/groups/123456"
          className="mt-2 w-full rounded border p-2 font-mono text-sm"
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => {
              const arr = urls.split('\n').map((s) => s.trim()).filter(Boolean);
              if (arr.length > 0) bulk.mutate({ urls: arr });
            }}
            className="rounded bg-blue-600 px-4 py-2 text-white"
          >
            Add
          </button>
        </div>
        {bulk.data && (
          <div className="mt-2 text-sm">
            Added {bulk.data.created.length}, skipped {bulk.data.skipped.length}.
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold">Groups ({list.data?.length ?? 0})</h2>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left">
              <th>Active</th><th>Name / ID</th><th>URL</th><th>Last posted</th><th></th>
            </tr>
          </thead>
          <tbody>
            {list.data?.map((g) => (
              <tr key={g.id} className="border-t">
                <td>
                  <input
                    type="checkbox"
                    checked={g.isActive}
                    onChange={(e) => setActive.mutate({ id: g.id, isActive: e.target.checked })}
                  />
                </td>
                <td>{g.name ?? g.fbGroupId}</td>
                <td className="text-blue-700"><a href={g.fbUrl} target="_blank">{g.fbUrl}</a></td>
                <td>{g.lastPosted ? new Date(g.lastPosted).toLocaleString() : '—'}</td>
                <td><button onClick={() => remove.mutate({ id: g.id })} className="text-red-600">Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
