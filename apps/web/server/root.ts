import { router } from './trpc.js';
import { sessionRouter } from './routers/session.js';
import { groupRouter } from './routers/group.js';
import { campaignRouter } from './routers/campaign.js';
import { settingRouter } from './routers/setting.js';

export const appRouter = router({
  session: sessionRouter,
  group: groupRouter,
  campaign: campaignRouter,
  setting: settingRouter,
});
export type AppRouter = typeof appRouter;
