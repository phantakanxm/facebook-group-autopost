'use client';
import { useRouter } from 'next/navigation';
import { ListingForm } from '@/components/listing-form';

export default function NewListingCampaignPage() {
  const router = useRouter();
  return (
    <main>
      <h2 className="mb-4 text-xl font-semibold">New Real Estate Listing</h2>
      <ListingForm onSaved={(id) => router.push(`/campaigns/${id}`)} />
    </main>
  );
}
