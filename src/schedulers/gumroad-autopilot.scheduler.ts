import { env } from '../config/env';
import { processNextGumroadAutopilotItem } from '../services/gumroad-autopilot.service';

let isRunning = false;

export function startGumroadAutopilotScheduler() {
  if (!env.GUMROAD_AUTOPILOT_ENABLED) {
    console.log('[GUMROAD-AUTOPILOT] Scheduler disabled. Set GUMROAD_AUTOPILOT_ENABLED=true to enable automatic product publishing.');
    return;
  }

  if (!env.GUMROAD_AUTOPILOT_DATABASE_ID) {
    console.warn('[GUMROAD-AUTOPILOT] Scheduler not started: missing GUMROAD_AUTOPILOT_DATABASE_ID.');
    return;
  }

  const intervalMs = env.GUMROAD_AUTOPILOT_INTERVAL_MS;
  console.log(`[GUMROAD-AUTOPILOT] Scheduler enabled. Interval=${formatInterval(intervalMs)} dailyLimit=${env.GUMROAD_AUTOPILOT_DAILY_LIMIT} publishLive=${env.GUMROAD_AUTOPILOT_PUBLISH_LIVE ? 'true' : 'false'} database=${env.GUMROAD_AUTOPILOT_DATABASE_ID}`);

  if (env.GUMROAD_AUTOPILOT_RUN_ON_START) {
    void tick('startup').catch(error => {
      console.error('[GUMROAD-AUTOPILOT] Startup tick failed:', error);
    });
  }

  setInterval(() => {
    void tick('interval').catch(error => {
      console.error('[GUMROAD-AUTOPILOT] Interval tick failed:', error);
    });
  }, intervalMs);
}

async function tick(reason: string) {
  if (isRunning) {
    console.log(`[GUMROAD-AUTOPILOT] Tick skipped (${reason}); previous autopilot job still running.`);
    return;
  }

  isRunning = true;
  const startedAt = Date.now();
  try {
    console.log(`[GUMROAD-AUTOPILOT] Tick started (${reason}).`);
    const result = await processNextGumroadAutopilotItem();
    console.log(`[GUMROAD-AUTOPILOT] Tick finished (${reason}) in ${Date.now() - startedAt}ms: ${JSON.stringify(result)}`);
  } finally {
    isRunning = false;
  }
}

function formatInterval(ms: number) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
