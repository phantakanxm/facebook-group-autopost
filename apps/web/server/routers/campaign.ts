import { router, publicProcedure } from '../trpc.js';
import { z } from 'zod';
import {
  campaignCreateSchema,
  campaignUpdateSchema,
  listingCreateSchema,
  MAX_GROUPS_PER_BATCH,
} from '@app/shared';

export const campaignRouter = router({
  list: publicProcedure.query(({ ctx }) =>
    ctx.prisma.campaign.findMany({
      where: { userId: ctx.userId },
      include: { groups: { include: { group: true } } },
      orderBy: { scheduledAt: 'desc' },
    }),
  ),

  get: publicProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) =>
    ctx.prisma.campaign.findUniqueOrThrow({
      where: { id: input.id },
      include: {
        groups: { include: { group: true }, orderBy: { order: 'asc' } },
        logs: { orderBy: { createdAt: 'desc' } },
        batches: {
          orderBy: { order: 'asc' },
          include: {
            groups: { include: { group: true }, orderBy: { order: 'asc' } },
          },
        },
      },
    }),
  ),

  create: publicProcedure.input(campaignCreateSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.campaign.create({
      data: {
        userId: ctx.userId,
        ...(input.title !== undefined && { title: input.title }),
        content: input.content,
        mediaType: input.mediaType,
        mediaFiles: JSON.stringify(input.mediaFiles),
        scheduledAt: input.scheduledAt,
        recurrence: input.recurrence ?? null,
        jitterMinutes: input.jitterMinutes,
        status: 'scheduled',
        groups: {
          create: input.groupIds.map((gid, i) => ({ groupId: gid, order: i })),
        },
      },
    });
  }),

  createListing: publicProcedure
    .input(listingCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // Fetch groups; verify all are listing-capable + active + belong to user.
      const groups = await ctx.prisma.group.findMany({
        where: {
          id: { in: input.groupIds },
          userId: ctx.userId,
          isActive: true,
        },
      });
      const foundIds = new Set(groups.map((g) => g.id));
      const missing = input.groupIds.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        throw new Error(`Groups not found or inactive: ${missing.join(',')}`);
      }
      const nonCapable = groups.filter((g) => !g.supportsListing).map((g) => g.fbGroupId);
      if (nonCapable.length > 0) {
        throw new Error(`Groups do not support listings: ${nonCapable.join(',')}`);
      }

      // Batching.
      const orderedGroups = input.groupIds
        .map((id) => groups.find((g) => g.id === id))
        .filter((g): g is typeof groups[number] => g !== undefined);
      const batchChunks: typeof orderedGroups[] = [];
      for (let i = 0; i < orderedGroups.length; i += MAX_GROUPS_PER_BATCH) {
        batchChunks.push(orderedGroups.slice(i, i + MAX_GROUPS_PER_BATCH));
      }

      const setting = await ctx.prisma.setting.findUniqueOrThrow({ where: { userId: ctx.userId } });
      const minDelay = input.batchDelayMinMs ?? setting.delayBetweenBatchesMinMs;
      const maxDelay = input.batchDelayMaxMs ?? setting.delayBetweenBatchesMaxMs;

      const batchScheduledAt: Date[] = [new Date(input.scheduledAt.getTime())];
      for (let i = 1; i < batchChunks.length; i++) {
        const prev = batchScheduledAt[i - 1]!;
        const delay = Math.floor(minDelay + Math.random() * (maxDelay - minDelay));
        batchScheduledAt.push(new Date(prev.getTime() + delay));
      }

      // Create campaign + batches + batch-groups in a transaction.
      const created = await ctx.prisma.$transaction(async (tx) => {
        const campaign = await tx.campaign.create({
          data: {
            userId: ctx.userId,
            content: input.content,
            mediaType: 'images',
            mediaFiles: JSON.stringify(input.mediaFiles),
            type: 'listing',
            listingKind: input.listingKind,
            propertyType: input.propertyType,
            bedrooms: input.bedrooms,
            bathrooms: input.bathrooms,
            priceBaht: input.priceBaht,
            location: input.location,
            scheduledAt: input.scheduledAt,
            recurrence: null,
            jitterMinutes: input.jitterMinutes,
            status: 'scheduled',
            ...(input.squareMetres != null ? { squareMetres: input.squareMetres } : {}),
            ...(input.batchDelayMinMs != null ? { batchDelayMinMs: input.batchDelayMinMs } : {}),
            ...(input.batchDelayMaxMs != null ? { batchDelayMaxMs: input.batchDelayMaxMs } : {}),
          },
        });

        for (let i = 0; i < batchChunks.length; i++) {
          const chunk = batchChunks[i]!;
          const batch = await tx.listingBatch.create({
            data: {
              campaignId: campaign.id,
              order: i,
              scheduledAt: batchScheduledAt[i]!,
              status: 'scheduled',
            },
          });
          for (let j = 0; j < chunk.length; j++) {
            await tx.listingBatchGroup.create({
              data: {
                batchId: batch.id,
                groupId: chunk[j]!.id,
                isPrimary: j === 0,
                order: j,
              },
            });
          }
        }
        return campaign;
      });

      return { id: created.id };
    }),

  update: publicProcedure.input(campaignUpdateSchema).mutation(async ({ ctx, input }) => {
    const existing = await ctx.prisma.campaign.findUniqueOrThrow({ where: { id: input.id } });
    if (existing.status === 'running') throw new Error('Cannot edit running campaign');

    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data['title'] = input.title;
    if (input.content !== undefined) data['content'] = input.content;
    if (input.scheduledAt !== undefined) data['scheduledAt'] = input.scheduledAt;
    if (input.recurrence !== undefined) data['recurrence'] = input.recurrence ?? null;
    if (input.jitterMinutes !== undefined) data['jitterMinutes'] = input.jitterMinutes;
    if (input.mediaFiles !== undefined) data['mediaFiles'] = JSON.stringify(input.mediaFiles);
    if (input.mediaType !== undefined) data['mediaType'] = input.mediaType;

    return ctx.prisma.campaign.update({ where: { id: input.id }, data });
  }),

  cancel: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const c = await ctx.prisma.campaign.findUniqueOrThrow({ where: { id: input.id } });
    if (c.status === 'completed' || c.status === 'failed') {
      throw new Error(`Campaign already ${c.status}`);
    }
    // Mark all SCHEDULED batches as skipped. Leave 'running' alone — that batch is
    // mid-Playwright action; it will finish naturally and its final status (completed
    // or failed) will be recorded truthfully in the log.
    if (c.type === 'listing') {
      await ctx.prisma.listingBatch.updateMany({
        where: { campaignId: c.id, status: 'scheduled' },
        data: { status: 'skipped' },
      });
    }
    // Flip the campaign itself. If it was running, the runner will see this on its
    // next iteration (before processing the next group/batch) and bail out. The
    // currently-posting FB action will complete as-is (cannot abort mid-Playwright).
    await ctx.prisma.campaign.update({
      where: { id: input.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        lastError: c.status === 'running' ? 'cancelled_by_user_mid_run' : 'cancelled_by_user',
      },
    });
    return { ok: true, wasRunning: c.status === 'running' };
  }),

  resume: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const c = await ctx.prisma.campaign.findUniqueOrThrow({ where: { id: input.id } });
    if (c.status !== 'paused') throw new Error('Only paused campaigns can be resumed');

    const now = new Date();
    const baseAt = new Date(now.getTime() + 5 * 60_000);

    if (c.type === 'listing') {
      const setting = await ctx.prisma.setting.findUniqueOrThrow({ where: { userId: c.userId } });
      const minDelay = c.batchDelayMinMs ?? setting.delayBetweenBatchesMinMs;
      const maxDelay = c.batchDelayMaxMs ?? setting.delayBetweenBatchesMaxMs;
      const pending = await ctx.prisma.listingBatch.findMany({
        where: { campaignId: c.id, status: { in: ['failed', 'scheduled'] } },
        orderBy: { order: 'asc' },
      });
      for (let i = 0; i < pending.length; i++) {
        const delay = i === 0 ? 0 : Math.floor(minDelay + Math.random() * (maxDelay - minDelay));
        const when = new Date(baseAt.getTime() + (i === 0 ? 0 : delay));
        await ctx.prisma.listingBatch.update({
          where: { id: pending[i]!.id },
          data: { status: 'scheduled', attempt: 0, lastError: null, scheduledAt: when },
        });
        if (i > 0) baseAt.setTime(when.getTime());
      }
    }

    await ctx.prisma.campaign.update({
      where: { id: input.id },
      data: { status: 'scheduled', scheduledAt: baseAt, lastError: null },
    });
    return { ok: true };
  }),
});
