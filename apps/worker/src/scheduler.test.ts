// apps/worker/src/scheduler.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { setupTestDb, seedBasic, type TestDb } from '../test/setup-db.js';
import { pollAndRunOnce } from './scheduler.js';

describe('pollAndRunOnce', () => {
  let db: TestDb;
  let prisma: PrismaClient;

  beforeEach(async () => {
    db = await setupTestDb();
    prisma = db.prisma;
  });
  afterEach(async () => { await db.cleanup(); });

  function adapter() {
    return {
      verifySession: vi.fn().mockResolvedValue({ valid: true }),
      openCampaign: vi.fn().mockResolvedValue({
        postToGroup: vi.fn().mockResolvedValue({ success: true }),
        postListingBatch: vi.fn().mockResolvedValue({ success: true }),
        close: vi.fn().mockResolvedValue(undefined),
      }),
    };
  }

  it('picks the earliest due campaign and runs it', async () => {
    const { user, groups } = await seedBasic(prisma, { groups: 2 });
    const now = new Date();
    const c1 = await prisma.campaign.create({
      data: {
        userId: user.id, content: 'first', status: 'scheduled',
        scheduledAt: new Date(now.getTime() - 60_000),
        groups: { create: [{ groupId: groups[0]!.id, order: 0 }] },
      },
    });
    await prisma.campaign.create({
      data: {
        userId: user.id, content: 'later', status: 'scheduled',
        scheduledAt: new Date(now.getTime() + 3_600_000),
        groups: { create: [{ groupId: groups[1]!.id, order: 0 }] },
      },
    });

    const a = adapter();
    const ran = await pollAndRunOnce({ prisma, adapter: a, fastMode: true });
    expect(ran).toBe(`post:${c1.id}`);

    const updated = await prisma.campaign.findUniqueOrThrow({ where: { id: c1.id } });
    expect(updated.status).toBe('completed');
  });

  it('returns null when no due campaign', async () => {
    const { user, groups } = await seedBasic(prisma, { groups: 1 });
    await prisma.campaign.create({
      data: {
        userId: user.id, content: 'later', status: 'scheduled',
        scheduledAt: new Date(Date.now() + 3_600_000),
        groups: { create: [{ groupId: groups[0]!.id, order: 0 }] },
      },
    });
    const ran = await pollAndRunOnce({ prisma, adapter: adapter(), fastMode: true });
    expect(ran).toBeNull();
  });

  it('ignores campaigns not in scheduled status', async () => {
    const { user, groups } = await seedBasic(prisma, { groups: 1 });
    await prisma.campaign.create({
      data: {
        userId: user.id, content: 'draft', status: 'draft',
        scheduledAt: new Date(Date.now() - 60_000),
        groups: { create: [{ groupId: groups[0]!.id, order: 0 }] },
      },
    });
    const ran = await pollAndRunOnce({ prisma, adapter: adapter(), fastMode: true });
    expect(ran).toBeNull();
  });
});

describe('pollAndRunOnce — listing batches', () => {
  let db: TestDb;
  let prisma: PrismaClient;

  beforeEach(async () => { db = await setupTestDb(); prisma = db.prisma; });
  afterEach(async () => { await db.cleanup(); });

  it('picks due listing batch and runs it', async () => {
    const { user, groups } = await seedBasic(prisma, { groups: 3 });
    const campaign = await prisma.campaign.create({
      data: {
        userId: user.id,
        content: 'hi',
        scheduledAt: new Date(Date.now() - 60_000),
        status: 'running',
        type: 'listing',
        listingKind: 'sale',
        propertyType: 'house',
        bedrooms: 2,
        bathrooms: 1,
        priceBaht: 1_000_000,
        location: 'UD',
        mediaFiles: JSON.stringify(['/tmp/a.jpg']),
        mediaType: 'images',
      },
    });
    const batch = await prisma.listingBatch.create({
      data: {
        campaignId: campaign.id,
        order: 0,
        scheduledAt: new Date(Date.now() - 60_000),
        status: 'scheduled',
      },
    });
    await prisma.listingBatchGroup.create({
      data: { batchId: batch.id, groupId: groups[0]!.id, isPrimary: true, order: 0 },
    });

    const postListingBatch = vi.fn().mockResolvedValue({ success: true, fbPostUrl: 'https://fb/l/1' });
    const a = {
      verifySession: vi.fn().mockResolvedValue({ valid: true }),
      openCampaign: vi.fn().mockResolvedValue({
        postToGroup: vi.fn(),
        postListingBatch,
        close: vi.fn().mockResolvedValue(undefined),
      }),
    };

    const ran = await pollAndRunOnce({ prisma, adapter: a, fastMode: true });
    expect(ran).toBe(`listing:${batch.id}`);

    const updated = await prisma.listingBatch.findUniqueOrThrow({ where: { id: batch.id } });
    expect(updated.status).toBe('completed');
  });
});
