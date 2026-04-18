import { router, publicProcedure } from '../trpc';

export const dashboardRouter = router({
  summary: publicProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600_000);
    const inSevenDays = new Date(now.getTime() + 7 * 24 * 3600_000);

    const [user, running, upcoming, recentLogs, pausedCount] = await Promise.all([
      ctx.prisma.user.findUniqueOrThrow({ where: { id: ctx.userId } }),
      ctx.prisma.campaign.findFirst({ where: { userId: ctx.userId, status: 'running' } }),
      ctx.prisma.campaign.findMany({
        where: { userId: ctx.userId, status: 'scheduled', scheduledAt: { gte: now, lte: inSevenDays } },
        orderBy: { scheduledAt: 'asc' },
        take: 10,
      }),
      ctx.prisma.postLog.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
      }),
      ctx.prisma.campaign.count({ where: { userId: ctx.userId, status: 'paused' } }),
    ]);

    const success = recentLogs.filter((l) => l.status === 'success').length;
    const failed = recentLogs.filter((l) => l.status === 'failed' || l.status === 'skipped').length;
    const total = success + failed;

    return {
      session: { valid: user.sessionValid, checkedAt: user.sessionChecked },
      running: running ? { id: running.id, title: running.title, startedAt: running.startedAt } : null,
      upcoming: upcoming.map((c) => ({ id: c.id, title: c.title, scheduledAt: c.scheduledAt })),
      recent: { success, failed, successRate: total === 0 ? null : success / total },
      pausedCount,
    };
  }),
});
