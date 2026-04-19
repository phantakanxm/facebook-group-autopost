import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { setupTestDb, seedBasic, type TestDb } from '../../test/setup-db.js';
import { runListingBatch, type PlaywrightAdapter } from './listing-runner.js';

async function seedListing(prisma: PrismaClient, groupCount: number, batchGroupCounts: number[]) {
  const { user, groups } = await seedBasic(prisma, { groups: groupCount });
  const campaign = await prisma.campaign.create({
    data: {
      userId: user.id,
      content: 'nice property',
      scheduledAt: new Date('2026-04-19T10:00:00Z'),
      status: 'scheduled',
      type: 'listing',
      listingKind: 'sale',
      propertyType: 'house',
      bedrooms: 3,
      bathrooms: 2,
      priceBaht: 3500000,
      location: 'Udon Thani',
      mediaFiles: JSON.stringify(['/tmp/a.jpg']),
      mediaType: 'images',
    },
  });

  let groupCursor = 0;
  for (let i = 0; i < batchGroupCounts.length; i++) {
    const batch = await prisma.listingBatch.create({
      data: {
        campaignId: campaign.id,
        order: i,
        scheduledAt: new Date(Date.now() + i * 3_600_000 - 60_000),
        status: 'scheduled',
      },
    });
    for (let j = 0; j < batchGroupCounts[i]!; j++) {
      const g = groups[groupCursor++]!;
      await prisma.listingBatchGroup.create({
        data: { batchId: batch.id, groupId: g.id, isPrimary: j === 0, order: j },
      });
    }
  }
  return { user, groups, campaign };
}

describe('runListingBatch', () => {
  let db: TestDb;
  let prisma: PrismaClient;

  beforeEach(async () => { db = await setupTestDb(); prisma = db.prisma; });
  afterEach(async () => { await db.cleanup(); });

  function makeAdapter(overrides: Partial<PlaywrightAdapter> = {}): PlaywrightAdapter {
    return {
      verifySession: vi.fn().mockResolvedValue({ valid: true }),
      openCampaign: vi.fn().mockResolvedValue({
        postToGroup: vi.fn(),
        postListingBatch: vi.fn().mockResolvedValue({ success: true, fbPostUrl: 'https://fb.com/l/1' }),
        close: vi.fn().mockResolvedValue(undefined),
      }),
      ...overrides,
    };
  }

  it('runs a due batch, marks completed, and marks campaign completed on last batch', async () => {
    const { campaign } = await seedListing(prisma, 5, [5]);
    const batches = await prisma.listingBatch.findMany({ where: { campaignId: campaign.id } });
    const adapter = makeAdapter();

    await runListingBatch({ batchId: batches[0]!.id, prisma, adapter, fastMode: true });

    const b = await prisma.listingBatch.findUniqueOrThrow({ where: { id: batches[0]!.id } });
    expect(b.status).toBe('completed');
    expect(b.fbPostUrl).toBe('https://fb.com/l/1');

    const c = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(c.status).toBe('completed');
  });

  it('keeps campaign running when intermediate batch completes', async () => {
    const { campaign } = await seedListing(prisma, 40, [21, 19]);
    const batches = await prisma.listingBatch.findMany({ where: { campaignId: campaign.id }, orderBy: { order: 'asc' } });
    const adapter = makeAdapter();

    await runListingBatch({ batchId: batches[0]!.id, prisma, adapter, fastMode: true });

    const c = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(c.status).toBe('running');

    const b1 = await prisma.listingBatch.findUniqueOrThrow({ where: { id: batches[1]!.id } });
    expect(b1.status).toBe('scheduled');
  });

  it('pauses campaign on critical error (session_invalid)', async () => {
    const { campaign } = await seedListing(prisma, 40, [21, 19]);
    const batches = await prisma.listingBatch.findMany({ where: { campaignId: campaign.id }, orderBy: { order: 'asc' } });
    const adapter = makeAdapter({
      openCampaign: vi.fn().mockResolvedValue({
        postToGroup: vi.fn(),
        postListingBatch: vi.fn().mockResolvedValue({ success: false, errorCategory: 'session_invalid', error: 'x' }),
        close: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await runListingBatch({ batchId: batches[0]!.id, prisma, adapter, fastMode: true });

    const c = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(c.status).toBe('paused');
    const b0 = await prisma.listingBatch.findUniqueOrThrow({ where: { id: batches[0]!.id } });
    expect(b0.status).toBe('failed');
    const b1 = await prisma.listingBatch.findUniqueOrThrow({ where: { id: batches[1]!.id } });
    expect(b1.status).toBe('scheduled');
  });

  it('reschedules batch on transient failure if attempt < 3', async () => {
    const { campaign } = await seedListing(prisma, 5, [5]);
    const batches = await prisma.listingBatch.findMany({ where: { campaignId: campaign.id } });
    const adapter = makeAdapter({
      openCampaign: vi.fn().mockResolvedValue({
        postToGroup: vi.fn(),
        postListingBatch: vi.fn().mockResolvedValue({ success: false, errorCategory: 'transient', error: 'net' }),
        close: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await runListingBatch({ batchId: batches[0]!.id, prisma, adapter, fastMode: true });

    const b = await prisma.listingBatch.findUniqueOrThrow({ where: { id: batches[0]!.id } });
    expect(b.status).toBe('scheduled');
    expect(b.attempt).toBe(1);
  });

  it('skips batch and continues campaign after 3 transient failures', async () => {
    const { campaign } = await seedListing(prisma, 5, [5]);
    const batches = await prisma.listingBatch.findMany({ where: { campaignId: campaign.id } });
    await prisma.listingBatch.update({ where: { id: batches[0]!.id }, data: { attempt: 2 } });

    const adapter = makeAdapter({
      openCampaign: vi.fn().mockResolvedValue({
        postToGroup: vi.fn(),
        postListingBatch: vi.fn().mockResolvedValue({ success: false, errorCategory: 'transient', error: 'net' }),
        close: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await runListingBatch({ batchId: batches[0]!.id, prisma, adapter, fastMode: true });

    const b = await prisma.listingBatch.findUniqueOrThrow({ where: { id: batches[0]!.id } });
    expect(b.status).toBe('skipped');
    const c = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(c.status).toBe('completed');
  });
});
