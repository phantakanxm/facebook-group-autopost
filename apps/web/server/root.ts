import { router } from './trpc.js';
import { sessionRouter } from './routers/session.js';
import { groupRouter } from './routers/group.js';
import { campaignRouter } from './routers/campaign.js';

export const appRouter = router({
  session: sessionRouter,
  group: groupRouter,
  campaign: campaignRouter,
});
export type AppRouter = typeof appRouter;
