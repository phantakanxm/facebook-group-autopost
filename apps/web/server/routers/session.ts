import { router, publicProcedure } from '../trpc.js';
import { z } from 'zod';

export const sessionRouter = router({
  status: publicProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: ctx.userId } });
    return {
      valid: user.sessionValid,
      checkedAt: user.sessionChecked,
    };
  }),

  /** Sets a flag that the worker polls; worker will open headed browser. */
  requestSetup: publicProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.user.update({
      where: { id: ctx.userId },
      data: { sessionPath: 'pending-setup', sessionValid: false },
    });
    return { ok: true };
  }),

  /** User clicks "verify" after logging in. Worker picks this up via polling. */
  requestVerify: publicProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.user.update({
      where: { id: ctx.userId },
      data: { sessionPath: 'pending-verify' },
    });
    return { ok: true };
  }),
});
