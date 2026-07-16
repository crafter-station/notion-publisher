import { env } from '../config/env';
import { processNextPostlyQueueItem } from '../services/postly-queue.service';

let isRunning = false;
let timer: NodeJS.Timeout | undefined;

export function startPostlyQueueScheduler() {
  if (!env.POSTLY_QUEUE_ENABLED) {
    console.log('[POSTLY-QUEUE] Scheduler disabled. Set POSTLY_QUEUE_ENABLED=true to enable automatic publishing.');
    return;
  }

  if (!env.POSTLY_QUEUE_DATABASE_ID) {
    console.warn('[POSTLY-QUEUE] Scheduler not started: missing POSTLY_QUEUE_DATABASE_ID.');
    return;
  }

  if (timer) return;

  const intervalMs = env.POSTLY_QUEUE_INTERVAL_MS;
  console.log(`[POSTLY-QUEUE] Scheduler enabled. Interval=${formatInterval(intervalMs)} database=${env.POSTLY_QUEUE_DATABASE_ID}`);

  if (env.POSTLY_QUEUE_RUN_ON_START) {
    runPostlyQueueTick('startup').catch(error => {
      console.error('[POSTLY-QUEUE] Startup tick failed:', error);
    });
  }

  timer = setInterval(() => {
    runPostlyQueueTick('interval').catch(error => {
      console.error('[POSTLY-QUEUE] Interval tick failed:', error);
    });
  }, intervalMs);
}

export async function runPostlyQueueTick(reason = 'manual') {
  if (isRunning) {
    console.log(`[POSTLY-QUEUE] Tick skipped (${reason}); previous queue job still running.`);
    return { status: 'busy' };
  }

  isRunning = true;
  const startedAt = Date.now();

  try {
    console.log(`[POSTLY-QUEUE] Tick started (${reason}).`);
    const result = await processNextPostlyQueueItem();
    console.log(`[POSTLY-QUEUE] Tick finished (${reason}) in ${Date.now() - startedAt}ms: ${JSON.stringify(result)}`);
    return result;
  } finally {
    isRunning = false;
  }
}

function formatInterval(ms: number) {
  const hours = ms / (60 * 60 * 1000);
  if (Number.isInteger(hours) && hours >= 1) return `${hours}h`;
  const minutes = ms / (60 * 1000);
  if (Number.isInteger(minutes) && minutes >= 1) return `${minutes}m`;
  return `${ms}ms`;
}
