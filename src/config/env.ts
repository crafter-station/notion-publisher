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
  /** Optional. Documented for future opt-in; publish path does not use it yet. */
  POSTLY_AUDIENCE_GROUP: process.env.POSTLY_AUDIENCE_GROUP || '',
  /** Optional MySkool (Skool) — not required to boot. Enables GET /capabilities/skool. */
  SKOOL_API_KEY: process.env.SKOOL_API_KEY || '',
  /** Optional default Skool group id for discover posts sample. */
  SKOOL_GROUP_ID: process.env.SKOOL_GROUP_ID || '',
  /** Must be "true" AND resolveLiveGate().live to call Postly. Default off. */
  POSTLY_PUBLISH_LIVE: process.env.POSTLY_PUBLISH_LIVE || '',
  /** Must be "true" AND resolveLiveGate().live to call Luma. Default off. */
  LUMA_PUBLISH_LIVE: process.env.LUMA_PUBLISH_LIVE || '',
  /** Optional Luma calendar API key — not required to boot. Enables publish-luma. */
  LUMA_API_KEY: process.env.LUMA_API_KEY || '',
  /** Optional GitHub PAT — catalog + TheVeller Releases. Not required to boot. */
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
  /** Must be "true" AND resolveLiveGate().live to create a Release. Default off. */
  GITHUB_PUBLISH_LIVE: process.env.GITHUB_PUBLISH_LIVE || '',
  /** Must be "true" AND resolveLiveGate().live to publish a Gumroad product. Default off. */
  GUMROAD_PUBLISH_LIVE: process.env.GUMROAD_PUBLISH_LIVE || '',
  /** Optional Composio — Reddit live; Eventbrite pending connect. Not required to boot. */
  COMPOSIO_API_KEY: process.env.COMPOSIO_API_KEY || '',
  /** Composio user that owns connected Reddit (dashboard / capabilities). */
  COMPOSIO_USER_ID: process.env.COMPOSIO_USER_ID || '',
  /** Default Reddit connected_account_id; Notion page can override. */
  COMPOSIO_CONNECTED_ACCOUNT_ID: process.env.COMPOSIO_CONNECTED_ACCOUNT_ID || '',
  /** Fallback subreddit if Notion `Reddit Subreddit` empty (smoke). */
  COMPOSIO_REDDIT_SUBREDDIT: process.env.COMPOSIO_REDDIT_SUBREDDIT || '',
  /** Eventbrite org id (else Notion Eventbrite Organization ID). */
  COMPOSIO_EVENTBRITE_ORGANIZATION_ID: process.env.COMPOSIO_EVENTBRITE_ORGANIZATION_ID || '',
  COMPOSIO_EVENTBRITE_CONNECTED_ACCOUNT_ID: process.env.COMPOSIO_EVENTBRITE_CONNECTED_ACCOUNT_ID || '',
  COMPOSIO_EVENTBRITE_CURRENCY: process.env.COMPOSIO_EVENTBRITE_CURRENCY || 'USD',
  COMPOSIO_EVENTBRITE_TOOLKIT_VERSION: process.env.COMPOSIO_EVENTBRITE_TOOLKIT_VERSION || '20260724_00',
  /** Must be "true" AND dryRun:false to execute Composio tools. Default off. */
  COMPOSIO_PUBLISH_LIVE: process.env.COMPOSIO_PUBLISH_LIVE || '',
  /** Optional Postiz — public API. Prefer self-hosted. Not required to boot. */
  POSTIZ_API_KEY: process.env.POSTIZ_API_KEY || '',
  /** Self-hosted or cloud. Default https://api.postiz.com/public/v1 */
  POSTIZ_API_BASE: process.env.POSTIZ_API_BASE || '',
  /** identifier:id pairs for wired channels (discord:abc,slack:def). */
  POSTIZ_INTEGRATIONS: process.env.POSTIZ_INTEGRATIONS || '',
  /** Must be "true" AND dryRun:false to hit POST /posts. Default off. */
  POSTIZ_PUBLISH_LIVE: process.env.POSTIZ_PUBLISH_LIVE || '',
  POSTIZ_DISCORD_CHANNEL: process.env.POSTIZ_DISCORD_CHANNEL || '',
  POSTIZ_SLACK_CHANNEL: process.env.POSTIZ_SLACK_CHANNEL || '',
  POSTIZ_SKOOL_GROUP: process.env.POSTIZ_SKOOL_GROUP || '',
  POSTIZ_SKOOL_LABEL: process.env.POSTIZ_SKOOL_LABEL || '',
  POSTIZ_LISTMONK_LIST: process.env.POSTIZ_LISTMONK_LIST || '',
  /** Optional Typefully — drafts only. Not required to boot. */
  TYPEFULLY_API_KEY: process.env.TYPEFULLY_API_KEY || '',
  /** Social set (account) id from GET /v2/social-sets */
  TYPEFULLY_SOCIAL_SET_ID: process.env.TYPEFULLY_SOCIAL_SET_ID || '',
  /** Must be "true" AND dryRun:false to POST a draft. Default off. */
  TYPEFULLY_PUBLISH_LIVE: process.env.TYPEFULLY_PUBLISH_LIVE || '',
  /** Optional Restream OAuth access token — dry-run works without it. */
  RESTREAM_ACCESS_TOKEN: process.env.RESTREAM_ACCESS_TOKEN || '',
  RESTREAM_CLIENT_ID: process.env.RESTREAM_CLIENT_ID || '',
  RESTREAM_CLIENT_SECRET: process.env.RESTREAM_CLIENT_SECRET || '',
  RESTREAM_REFRESH_TOKEN: process.env.RESTREAM_REFRESH_TOKEN || '',
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
  /**
   * Required to boot the HTTP server. Must be at least 32 characters.
   * Authorization: Bearer $WEBHOOK_TOKEN on every /webhooks/* request.
   */
  WEBHOOK_TOKEN: process.env.WEBHOOK_TOKEN || '',
  /**
   * Content OS ids default in src/config/schema.ts. Env overrides only.
   * CONTENT_OS_PUBLISH_LIVE must be the string "true" to open the live gate.
   */
  CONTENT_OS_PUBLISH_LIVE: process.env.CONTENT_OS_PUBLISH_LIVE || '',
  NOTION_CANALES_DATABASE_ID: process.env.NOTION_CANALES_DATABASE_ID || '',
  NOTION_CUENTAS_DATABASE_ID: process.env.NOTION_CUENTAS_DATABASE_ID || '',
  NOTION_PIEZAS_DATABASE_ID: process.env.NOTION_PIEZAS_DATABASE_ID || '',
  NOTION_PUBLICACIONES_DATABASE_ID: process.env.NOTION_PUBLICACIONES_DATABASE_ID || '',
  NOTION_PRODUCTOS_DATABASE_ID: process.env.NOTION_PRODUCTOS_DATABASE_ID || '',
  NOTION_CONTENT_OS_PARENT_PAGE_ID: process.env.NOTION_CONTENT_OS_PARENT_PAGE_ID || '',
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
