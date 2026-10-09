import { createCallerFactory, router } from './trpc';
import { accountsRouter } from './routers/accounts';
import { authRouter } from './routers/auth';
import { entriesRouter } from './routers/entries';
import { healthRouter } from './routers/health';
import { settingsRouter } from './routers/settings';

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  accounts: accountsRouter,
  entries: entriesRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
