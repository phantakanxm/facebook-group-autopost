'use client';
import Link from 'next/link';

export default function NewCampaignTypePicker() {
  return (
    <main className="space-y-6">
      <h2 className="text-xl font-semibold">Create new campaign</h2>
      <p className="text-sm text-neutral-600">Choose what kind of campaign you want to create.</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          href="/campaigns/new/post"
          className="rounded-lg border border-neutral-200 bg-white p-6 transition-colors hover:border-blue-500"
        >
          <div className="mb-2 text-3xl">📝</div>
          <h3 className="text-lg font-semibold">Regular Post</h3>
          <p className="mt-2 text-sm text-neutral-600">
            Post text + media to multiple groups sequentially. Best for announcements and general content.
          </p>
          <span className="mt-4 inline-block text-sm font-medium text-blue-700">Continue →</span>
        </Link>
        <Link
          href="/campaigns/new/listing"
          className="rounded-lg border border-neutral-200 bg-white p-6 transition-colors hover:border-green-500"
        >
          <div className="mb-2 text-3xl">🏠</div>
          <h3 className="text-lg font-semibold">Real Estate Listing</h3>
          <p className="mt-2 text-sm text-neutral-600">
            Structured property listing with native multi-group share (up to 21 groups per batch).
            Requires groups that support Facebook Marketplace listings.
          </p>
          <span className="mt-4 inline-block text-sm font-medium text-green-700">Continue →</span>
        </Link>
      </div>
    </main>
  );
}
