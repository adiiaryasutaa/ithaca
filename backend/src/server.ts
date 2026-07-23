import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

app.listen(env.APP_PORT, () => {
  logger.info({ port: env.APP_PORT }, 'Backend running');
});
