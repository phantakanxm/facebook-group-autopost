import { router, publicProcedure } from '../trpc';
import { z } from 'zod';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { resolveAppPaths } from '@app/shared/paths';

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

  /** Switch account: full reset. Wipes the Playwright profile dir, all
   * groups/campaigns/batches/postLogs/uploads belonging to this user, and
   * clears session flags. The User row itself + Setting are kept (so
   * preferences survive). Use when handing the app to a different FB
   * account from scratch.
   *
   * Done in-process (web tRPC) instead of via worker poll to avoid the
   * race where 'pending-setup' overwrote 'pending-signout' before the
   * worker tick. */
  requestSignOut: publicProcedure.mutation(async ({ ctx }) => {
    const repoRoot = path.resolve(process.cwd(), '..', '..');
    const { sessionRoot, uploadRoot } = resolveAppPaths({ repoRoot });
    const userSessionDir = path.join(sessionRoot, ctx.userId);

    // Count what we'll remove so the caller can show a meaningful toast.
    const counts = {
      groups: await ctx.prisma.group.count({ where: { userId: ctx.userId } }),
      campaigns: await ctx.prisma.campaign.count({ where: { userId: ctx.userId } }),
      postLogs: await ctx.prisma.postLog.count({
        where: { campaign: { userId: ctx.userId } },
      }),
    };

    // Delete DB rows in dependency order (no schema-level cascades for
    // group→postLog or group→listingBatchGroup, so do it manually).
    await ctx.prisma.$transaction([
      ctx.prisma.postLog.deleteMany({
        where: { campaign: { userId: ctx.userId } },
      }),
      ctx.prisma.listingBatchGroup.deleteMany({
        where: { batch: { campaign: { userId: ctx.userId } } },
      }),
      ctx.prisma.listingBatch.deleteMany({
        where: { campaign: { userId: ctx.userId } },
      }),
      ctx.prisma.campaignGroup.deleteMany({
        where: { campaign: { userId: ctx.userId } },
      }),
      ctx.prisma.campaign.deleteMany({
        where: { userId: ctx.userId },
      }),
      ctx.prisma.group.deleteMany({
        where: { userId: ctx.userId },
      }),
    ]);

    // Wipe the Playwright profile (FB cookies / login state).
    let sessionRemoved = false;
    try {
      rmSync(userSessionDir, { recursive: true, force: true });
      sessionRemoved = true;
    } catch {
      /* best-effort */
    }

    // Wipe uploaded media dir — campaigns referencing it are gone, so the
    // files are now orphaned. Path is shared across users so just wipe
    // contents (keep the dir itself for the next campaign).
    try {
      rmSync(uploadRoot, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }

    await ctx.prisma.user.update({
      where: { id: ctx.userId },
      data: {
        sessionPath: null,
        sessionValid: false,
        sessionChecked: new Date(),
      },
    });

    return { ok: true, sessionRemoved, ...counts };
  }),
});
