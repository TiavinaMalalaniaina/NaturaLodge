import { appEnv } from './lib/env';
import { app } from './app';
import { startScheduler } from './lib/scheduler';
import { logger } from './lib/logger';

const PORT = process.env.PORT ?? 4000;

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled_rejection');
});

app.listen(PORT, () => {
  logger.info(`🏨 NaturaLodge API running on http://localhost:${PORT} (${appEnv})`);
  startScheduler();
});
