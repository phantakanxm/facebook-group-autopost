import { router } from './trpc.js';
import { sessionRouter } from './routers/session.js';
import { groupRouter } from './routers/group.js';
import { campaignRouter } from './routers/campaign.js';
import { settingRouter } from './routers/setting.js';
import { logRouter } from './routers/log.js';

export const appRouter = router({
  session: sessionRouter,
  group: groupRouter,
  campaign: campaignRouter,
  setting: settingRouter,
  log: logRouter,
});
export type AppRouter = typeof appRouter;
