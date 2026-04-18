import { router } from './trpc';
import { sessionRouter } from './routers/session';
import { groupRouter } from './routers/group';
import { campaignRouter } from './routers/campaign';
import { settingRouter } from './routers/setting';
import { logRouter } from './routers/log';
import { dashboardRouter } from './routers/dashboard';

export const appRouter = router({
  session: sessionRouter,
  group: groupRouter,
  campaign: campaignRouter,
  setting: settingRouter,
  log: logRouter,
  dashboard: dashboardRouter,
});
export type AppRouter = typeof appRouter;
