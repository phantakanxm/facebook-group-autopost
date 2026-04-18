import { router, publicProcedure } from '../trpc';
import { z } from 'zod';
import { campaignCreateSchema, campaignUpdateSchema } from '@app/shared';

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
    if (c.status === 'running') throw new Error('Cannot cancel running campaign (it will complete its current group)');
    await ctx.prisma.campaign.update({ where: { id: input.id }, data: { status: 'completed', completedAt: new Date() } });
    return { ok: true };
  }),

  resume: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const c = await ctx.prisma.campaign.findUniqueOrThrow({ where: { id: input.id } });
    if (c.status !== 'paused') throw new Error('Only paused campaigns can be resumed');
    await ctx.prisma.campaign.update({
      where: { id: input.id },
      data: { status: 'scheduled', scheduledAt: new Date(Date.now() + 5 * 60_000), lastError: null },
    });
    return { ok: true };
  }),
});
