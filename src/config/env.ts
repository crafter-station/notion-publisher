import 'dotenv/config';

/**
 * Validates and exports environment variables.
 * If a required variable is missing, the process will exit immediately.
 */

const requiredVars = ['NOTION_TOKEN', 'GUMROAD_TOKEN', 'POSTLY_API_KEY', 'POSTLY_WORKSPACE_ID', 'POSTLY_TARGET_PLATFORMS'] as const;

export const env = {
  NOTION_TOKEN: process.env.NOTION_TOKEN!,
  NOTION_DATABASE_ID: process.env.NOTION_DATABASE_ID,
  GUMROAD_TOKEN: process.env.GUMROAD_TOKEN!,
  POSTLY_API_KEY: process.env.POSTLY_API_KEY!,
  POSTLY_WORKSPACE_ID: process.env.POSTLY_WORKSPACE_ID!,
  POSTLY_TARGET_PLATFORMS: process.env.POSTLY_TARGET_PLATFORMS!,
  POSTLY_QUEUE_ENABLED: process.env.POSTLY_QUEUE_ENABLED === 'true',
  POSTLY_QUEUE_DATABASE_ID: process.env.POSTLY_QUEUE_DATABASE_ID || process.env.NOTION_DATABASE_ID,
  POSTLY_QUEUE_INTERVAL_MS: Number(process.env.POSTLY_QUEUE_INTERVAL_MS) || 6 * 60 * 60 * 1000,
  POSTLY_QUEUE_RUN_ON_START: process.env.POSTLY_QUEUE_RUN_ON_START === 'true',
  POSTLY_QUEUE_BLOCK_ON_PENDING_POSTS: process.env.POSTLY_QUEUE_BLOCK_ON_PENDING_POSTS !== 'false',
  POSTLY_QUEUE_PENDING_BLOCK_WINDOW_MS: Number(process.env.POSTLY_QUEUE_PENDING_BLOCK_WINDOW_MS) || 6 * 60 * 60 * 1000,
  GUMROAD_AUTOPILOT_ENABLED: process.env.GUMROAD_AUTOPILOT_ENABLED === 'true',
  GUMROAD_AUTOPILOT_DATABASE_ID: process.env.GUMROAD_AUTOPILOT_DATABASE_ID || process.env.NOTION_DATABASE_ID,
  GUMROAD_AUTOPILOT_INTERVAL_MS: Number(process.env.GUMROAD_AUTOPILOT_INTERVAL_MS) || 144 * 60 * 1000,
  GUMROAD_AUTOPILOT_RUN_ON_START: process.env.GUMROAD_AUTOPILOT_RUN_ON_START === 'true',
  GUMROAD_AUTOPILOT_DAILY_LIMIT: Number(process.env.GUMROAD_AUTOPILOT_DAILY_LIMIT) || 10,
  GUMROAD_AUTOPILOT_TIMEZONE: process.env.GUMROAD_AUTOPILOT_TIMEZONE || 'America/Lima',
  GUMROAD_AUTOPILOT_PUBLISH_LIVE: process.env.GUMROAD_AUTOPILOT_PUBLISH_LIVE === 'true',
  PORT: Number(process.env.PORT) || 3000,
};

// Validation logic
const missingVars: string[] = [];

for (const key of requiredVars) {
  if (!process.env[key]) {
    missingVars.push(key);
  }
}

if (missingVars.length > 0) {
  console.error('\n❌ [FATAL ERROR] Missing required environment variables:');
  missingVars.forEach(v => console.error(`   - ${v}`));
  console.error('\nPlease check your .env file or deployment environment variables.\n');
  process.exit(1);
}
