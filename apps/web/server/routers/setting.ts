import { router, publicProcedure } from '../trpc';
import { z } from 'zod';

const settingSchema = z.object({
  delayBetweenGroupsMinMs: z.number().int().min(0).max(3_600_000),
  delayBetweenGroupsMaxMs: z.number().int().min(0).max(3_600_000),
  delayBeforePostMinMs: z.number().int().min(0).max(60_000),
  delayBeforePostMaxMs: z.number().int().min(0).max(60_000),
  delayAfterFocusMinMs: z.number().int().min(0).max(60_000),
  delayAfterFocusMaxMs: z.number().int().min(0).max(60_000),
  maxRetryPerGroup: z.number().int().min(0).max(10),
  retryDelayMinMs: z.number().int().min(0).max(3_600_000),
  retryDelayMaxMs: z.number().int().min(0).max(3_600_000),
  stopAfterConsecutiveFailures: z.number().int().min(1).max(20),
  enableMouseMove: z.boolean(),
  enableScrollBeforePost: z.boolean(),
  enableJitter: z.boolean(),
});

export const settingRouter = router({
  get: publicProcedure.query(async ({ ctx }) =>
    ctx.prisma.setting.findUniqueOrThrow({ where: { userId: ctx.userId } }),
  ),

  update: publicProcedure.input(settingSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.setting.update({ where: { userId: ctx.userId }, data: input });
  }),
});
