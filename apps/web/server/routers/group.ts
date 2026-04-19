import { router, publicProcedure } from '../trpc';
import { z } from 'zod';
import { groupCreateSchema, groupBulkCreateSchema, parseGroupUrl } from '@app/shared';

export const groupRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.group.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: 'desc' },
    });
  }),

  create: publicProcedure.input(groupCreateSchema).mutation(async ({ ctx, input }) => {
    const parsed = parseGroupUrl(input.fbUrl)!;
    return ctx.prisma.group.upsert({
      where: { userId_fbGroupId: { userId: ctx.userId, fbGroupId: parsed.fbGroupId } },
      create: {
        userId: ctx.userId,
        fbGroupId: parsed.fbGroupId,
        fbUrl: parsed.canonicalUrl,
        ...(input.name !== undefined && { name: input.name }),
        source: input.source,
      },
      update: { ...(input.name !== undefined && { name: input.name }), isActive: true },
    });
  }),

  bulkCreate: publicProcedure.input(groupBulkCreateSchema).mutation(async ({ ctx, input }) => {
    const created: Array<{ id: string; fbGroupId: string }> = [];
    const skipped: string[] = [];
    for (const url of input.urls) {
      const parsed = parseGroupUrl(url);
      if (!parsed) { skipped.push(url); continue; }
      const g = await ctx.prisma.group.upsert({
        where: { userId_fbGroupId: { userId: ctx.userId, fbGroupId: parsed.fbGroupId } },
        create: {
          userId: ctx.userId, fbGroupId: parsed.fbGroupId, fbUrl: parsed.canonicalUrl, source: 'manual',
        },
        update: { isActive: true },
      });
      created.push({ id: g.id, fbGroupId: g.fbGroupId });
    }
    return { created, skipped };
  }),

  setActive: publicProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.group.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
      });
      return { ok: true };
    }),

  remove: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    // Soft-remove by deactivating (keep for historical PostLog integrity)
    await ctx.prisma.group.update({ where: { id: input.id }, data: { isActive: false } });
    return { ok: true };
  }),

  requestAutoSync: publicProcedure.mutation(async ({ ctx }) => {
    // Write a flag row by setting sessionPath marker on User. Worker polls this.
    await ctx.prisma.user.update({
      where: { id: ctx.userId },
      data: { sessionPath: 'pending-group-sync' },
    });
    return { ok: true };
  }),

  requestCapabilityScan: publicProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.user.update({
      where: { id: ctx.userId },
      data: { sessionPath: 'pending-capability-scan' },
    });
    return { ok: true };
  }),

  requestCapabilityRescanAll: publicProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.user.update({
      where: { id: ctx.userId },
      data: { sessionPath: 'pending-capability-rescan-all' },
    });
    return { ok: true };
  }),
});
