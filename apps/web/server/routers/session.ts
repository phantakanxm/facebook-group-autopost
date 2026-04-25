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

  /** Disconnect: wipe the Playwright profile dir IN-PROCESS so "Open
   * browser to log in" right after starts from a clean slate. We used to
   * hand this off to the worker via a 'pending-signout' state, but a
   * subsequent 'pending-setup' write (from clicking the login button)
   * raced and silently overwrote it before the worker could pick it up.
   *
   * The web process and the worker share the same SESSION_ROOT env var
   * (Electron main sets it for both), so we can resolve the same path
   * here and delete it synchronously before returning. */
  requestSignOut: publicProcedure.mutation(async ({ ctx }) => {
    const repoRoot = path.resolve(process.cwd(), '..', '..');
    const { sessionRoot } = resolveAppPaths({ repoRoot });
    const userSessionDir = path.join(sessionRoot, ctx.userId);

    let removed = false;
    let removeError: string | undefined;
    try {
      rmSync(userSessionDir, { recursive: true, force: true });
      removed = true;
    } catch (err) {
      removeError = err instanceof Error ? err.message : String(err);
    }

    await ctx.prisma.user.update({
      where: { id: ctx.userId },
      data: {
        sessionPath: null,
        sessionValid: false,
        sessionChecked: new Date(),
      },
    });

    return { ok: true, removed, error: removeError };
  }),
});
