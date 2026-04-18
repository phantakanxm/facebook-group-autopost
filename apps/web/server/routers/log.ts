import { router, publicProcedure } from '../trpc.js';
import { z } from 'zod';

export const logRouter = router({
  recent: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(500).default(100) }))
    .query(({ ctx, input }) =>
      ctx.prisma.postLog.findMany({
        take: input.limit,
        orderBy: { createdAt: 'desc' },
        include: { campaign: true, group: true },
      }),
    ),
});
