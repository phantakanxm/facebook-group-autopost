import { router } from './trpc.js';
import { sessionRouter } from './routers/session.js';

export const appRouter = router({
  session: sessionRouter,
});
export type AppRouter = typeof appRouter;
