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
    expect(ran).toBe(c1.id);

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
