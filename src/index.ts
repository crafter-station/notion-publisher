import { env } from './config/env';
import { requireWebhookToken, startPublisherHttpServer } from './http/create-server';
import { startGumroadAutopilotScheduler } from './schedulers/gumroad-autopilot.scheduler';
import { startPostlyQueueScheduler } from './schedulers/postly-queue.scheduler';

try {
  requireWebhookToken(env.WEBHOOK_TOKEN);
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n❌ [FATAL ERROR] ${message}`);
  console.error('Set WEBHOOK_TOKEN to a secret of at least 32 characters.\n');
  process.exit(1);
}

startPublisherHttpServer(env.PORT, env.WEBHOOK_TOKEN);
startGumroadAutopilotScheduler();
startPostlyQueueScheduler();
