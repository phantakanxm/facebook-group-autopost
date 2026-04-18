'use client';
import { CampaignForm } from '@/components/campaign-form';
import { useRouter } from 'next/navigation';

export default function NewCampaignPage() {
  const router = useRouter();
  return (
    <main>
      <h2 className="mb-4 text-xl font-semibold">New Campaign</h2>
      <CampaignForm onSaved={(id) => router.push(`/campaigns/${id}`)} />
    </main>
  );
}
