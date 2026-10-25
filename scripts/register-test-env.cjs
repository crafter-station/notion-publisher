/**
 * Preload for node:test — satisfies env.ts required boot vars without real secrets.
 * Usage: node --require ./scripts/register-test-env.cjs --require ts-node/register/transpile-only --test
 */
process.env.NOTION_TOKEN = process.env.NOTION_TOKEN || 'test-notion-token';
process.env.GUMROAD_TOKEN = process.env.GUMROAD_TOKEN || 'test-gumroad-token';
process.env.POSTLY_API_KEY = process.env.POSTLY_API_KEY || 'test-postly-key';
process.env.POSTLY_WORKSPACE_ID = process.env.POSTLY_WORKSPACE_ID || 'test-workspace';
process.env.POSTLY_TARGET_PLATFORMS = process.env.POSTLY_TARGET_PLATFORMS || 'x:1';
process.env.NOTION_PUBLISHER_TEST = '1';
process.env.COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY || 'test-composio-key';
