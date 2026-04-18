'use client';
import { trpc } from '@/lib/trpc-client';

export default function SessionPage() {
  const status = trpc.session.status.useQuery();
  const setup = trpc.session.requestSetup.useMutation({ onSuccess: () => status.refetch() });
  const verify = trpc.session.requestVerify.useMutation({ onSuccess: () => status.refetch() });

  return (
    <main className="space-y-4">
      <h2 className="text-xl font-semibold">Facebook Session</h2>
      <p>
        Status:{' '}
        <span className={status.data?.valid ? 'text-green-700' : 'text-red-700'}>
          {status.data?.valid ? 'valid' : 'invalid'}
        </span>
        {status.data?.checkedAt && (
          <span className="ml-2 text-neutral-500">
            (checked {new Date(status.data.checkedAt).toLocaleString()})
          </span>
        )}
      </p>

      <div className="space-y-2">
        <button
          onClick={() => setup.mutate()}
          className="rounded bg-blue-600 px-4 py-2 text-white"
          disabled={setup.isPending}
        >
          1. Open browser to log in
        </button>
        <p className="text-sm text-neutral-600">
          Worker will open a Chrome window. Log in to Facebook (including 2FA), then close that window.
        </p>

        <button
          onClick={() => verify.mutate()}
          className="rounded bg-green-600 px-4 py-2 text-white"
          disabled={verify.isPending}
        >
          2. Verify session
        </button>
        <p className="text-sm text-neutral-600">
          After closing the login window, click verify to confirm the session works.
        </p>
      </div>
    </main>
  );
}
