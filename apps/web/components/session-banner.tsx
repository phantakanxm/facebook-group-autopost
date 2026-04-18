'use client';
import { trpc } from '@/lib/trpc-client';
import Link from 'next/link';

export function SessionBanner() {
  const status = trpc.session.status.useQuery();
  if (status.data?.valid) return null;
  return (
    <div className="mb-4 rounded bg-red-100 p-3 text-red-900">
      Facebook session is invalid. <Link href="/session" className="underline font-semibold">Re-authenticate</Link>
    </div>
  );
}
