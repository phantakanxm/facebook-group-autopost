// apps/worker/src/campaigns/runner.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { setupTestDb, seedBasic, type TestDb } from '../../test/setup-db.js';
import { runCampaign, type PlaywrightAdapter } from './runner.js';

describe('runCampaign', () => {
  let db: TestDb;
  let prisma: PrismaClient;

  beforeEach(async () => {
    db = await setupTestDb();
    prisma = db.prisma;
  });
  afterEach(async () => { await db.cleanup(); });

  function makeAdapter(overrides: Partial<PlaywrightAdapter> = {}): PlaywrightAdapter {
    return {
      verifySession: vi.fn().mockResolvedValue({ valid: true }),
      postToGroup: vi.fn().mockResolvedValue({ success: true, fbPostUrl: 'https://fb.com/p/1' }),
      ...overrides,
    };
  }

  it('posts to all target groups and marks campaign completed', async () => {
    const { user, groups } = await seedBasic(prisma, { groups: 3 });
    const campaign = await prisma.campaign.create({
      data: {
        userId: user.id, content: 'hi', scheduledAt: new Date(), status: 'scheduled',
        groups: { create: groups.map((g, i) => ({ groupId: g.id, order: i })) },
      },
    });

    const adapter = makeAdapter();
    await runCampaign({ campaignId: campaign.id, prisma, adapter, fastMode: true });

    expect(adapter.postToGroup).toHaveBeenCalledTimes(3);
    const updated = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(updated.status).toBe('completed');
    const logs = await prisma.postLog.findMany({ where: { campaignId: campaign.id } });
    expect(logs).toHaveLength(3);
    expect(logs.every((l) => l.status === 'success')).toBe(true);
  });

  it('pauses campaign after consecutive failures threshold', async () => {
    const { user, groups } = await seedBasic(prisma, { groups: 5 });
    const campaign = await prisma.campaign.create({
      data: {
        userId: user.id, content: 'hi', scheduledAt: new Date(), status: 'scheduled',
        groups: { create: groups.map((g, i) => ({ groupId: g.id, order: i })) },
      },
    });

    const adapter = makeAdapter({
      postToGroup: vi.fn().mockResolvedValue({ success: false, errorCategory: 'transient', error: 'x' }),
    });
    await runCampaign({ campaignId: campaign.id, prisma, adapter, fastMode: true });

    const updated = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(updated.status).toBe('paused');
    // 3 groups * (1 initial + 2 retries) = 9 attempts, then stop
    expect(adapter.postToGroup).toHaveBeenCalledTimes(9);
  });

  it('pauses immediately if session is invalid', async () => {
    const { user, groups } = await seedBasic(prisma, { groups: 3 });
    const campaign = await prisma.campaign.create({
      data: {
        userId: user.id, content: 'hi', scheduledAt: new Date(), status: 'scheduled',
        groups: { create: groups.map((g, i) => ({ groupId: g.id, order: i })) },
      },
    });

    const adapter = makeAdapter({
      verifySession: vi.fn().mockResolvedValue({ valid: false, reason: 'session_invalid' }),
    });
    await runCampaign({ campaignId: campaign.id, prisma, adapter, fastMode: true });

    const updated = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(updated.status).toBe('paused');
    expect(adapter.postToGroup).not.toHaveBeenCalled();
  });

  it('resumes: skips groups that already have success in PostLog', async () => {
    const { user, groups } = await seedBasic(prisma, { groups: 3 });
    const campaign = await prisma.campaign.create({
      data: {
        userId: user.id, content: 'hi', scheduledAt: new Date(), status: 'scheduled',
        groups: { create: groups.map((g, i) => ({ groupId: g.id, order: i })) },
      },
    });
    // Pre-populate one success log (as if from prior run)
    await prisma.postLog.create({
      data: { campaignId: campaign.id, groupId: groups[0]!.id, status: 'success' },
    });

    const adapter = makeAdapter();
    await runCampaign({ campaignId: campaign.id, prisma, adapter, fastMode: true });

    // Only groups 1 and 2 posted (group 0 already successful)
    expect(adapter.postToGroup).toHaveBeenCalledTimes(2);
  });
});
