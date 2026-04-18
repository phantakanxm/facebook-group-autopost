'use client';
import { trpc } from '@/lib/trpc-client';
import { useEffect, useState } from 'react';

type Values = {
  delayBetweenGroupsMinMs: number; delayBetweenGroupsMaxMs: number;
  delayBeforePostMinMs: number; delayBeforePostMaxMs: number;
  delayAfterFocusMinMs: number; delayAfterFocusMaxMs: number;
  maxRetryPerGroup: number;
  retryDelayMinMs: number; retryDelayMaxMs: number;
  stopAfterConsecutiveFailures: number;
  enableMouseMove: boolean; enableScrollBeforePost: boolean; enableJitter: boolean;
};

const PAIRS: Array<[keyof Values, keyof Values, string]> = [
  ['delayBetweenGroupsMinMs', 'delayBetweenGroupsMaxMs', 'Delay between groups (ms)'],
  ['delayBeforePostMinMs',    'delayBeforePostMaxMs',    'Delay before click Post (ms)'],
  ['delayAfterFocusMinMs',    'delayAfterFocusMaxMs',    'Delay after focus composer (ms)'],
  ['retryDelayMinMs',         'retryDelayMaxMs',         'Retry delay (ms)'],
];

export default function SettingsPage() {
  const get = trpc.setting.get.useQuery();
  const update = trpc.setting.update.useMutation({ onSuccess: () => get.refetch() });
  const [v, setV] = useState<Values | null>(null);

  useEffect(() => {
    if (get.data && !v) {
      const { id, userId, ...rest } = get.data;
      setV(rest as Values);
    }
  }, [get.data, v]);

  if (!v) return <p>Loading…</p>;
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV({ ...v, [k]: val });

  return (
    <main className="space-y-6">
      <h2 className="text-xl font-semibold">Settings</h2>

      {PAIRS.map(([kmin, kmax, label]) => (
        <div key={kmin as string} className="flex items-center gap-4">
          <label className="w-64">{label}</label>
          <input
            type="number" className="rounded border p-2 w-32"
            value={v[kmin] as number} onChange={(e) => set(kmin, Number(e.target.value) as Values[typeof kmin])}
          />
          <span>to</span>
          <input
            type="number" className="rounded border p-2 w-32"
            value={v[kmax] as number} onChange={(e) => set(kmax, Number(e.target.value) as Values[typeof kmax])}
          />
        </div>
      ))}

      <div className="flex items-center gap-4">
        <label className="w-64">Max retry per group</label>
        <input type="number" className="rounded border p-2 w-24"
          value={v.maxRetryPerGroup} onChange={(e) => set('maxRetryPerGroup', Number(e.target.value))} />
      </div>
      <div className="flex items-center gap-4">
        <label className="w-64">Stop after consecutive failures</label>
        <input type="number" className="rounded border p-2 w-24"
          value={v.stopAfterConsecutiveFailures} onChange={(e) => set('stopAfterConsecutiveFailures', Number(e.target.value))} />
      </div>

      <div className="flex items-center gap-4"><input type="checkbox" checked={v.enableMouseMove} onChange={(e) => set('enableMouseMove', e.target.checked)} /> Curved mouse moves</div>
      <div className="flex items-center gap-4"><input type="checkbox" checked={v.enableScrollBeforePost} onChange={(e) => set('enableScrollBeforePost', e.target.checked)} /> Scroll before posting</div>
      <div className="flex items-center gap-4"><input type="checkbox" checked={v.enableJitter} onChange={(e) => set('enableJitter', e.target.checked)} /> Apply schedule jitter</div>

      <button
        onClick={() => update.mutate(v)}
        className="rounded bg-blue-600 px-4 py-2 text-white"
        disabled={update.isPending}
      >
        Save
      </button>
    </main>
  );
}
