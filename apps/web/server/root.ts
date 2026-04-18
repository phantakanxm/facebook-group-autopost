import { router } from './trpc.js';
import { sessionRouter } from './routers/session.js';
import { groupRouter } from './routers/group.js';

export const appRouter = router({
  session: sessionRouter,
  group: groupRouter,
});
export type AppRouter = typeof appRouter;
