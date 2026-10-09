// Read-only diagnostics. Never import the server: it starts publication schedulers.
const fs = require('node:fs');
const dotenv = require('dotenv');
const { checkRedditConnection } = require('./lib/reddit-connection.cjs');
const { checkTypefullyConnection } = require('./lib/typefully-connection.cjs');

async function main() {
  const file = process.argv[2] || '.env';
  // An explicit missing file is an invocation error, not disconnected providers.
  if (process.argv[2] && !fs.existsSync(file)) {
    console.log(JSON.stringify({ state: 'configuration_file_not_found', scope: 'no provider requests made' }));
    process.exitCode = 2;
    return;
  }
  const env = { ...(fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {}), ...process.env };
  const checks = [
    ['notion', ['NOTION_TOKEN', 'NOTION_DATABASE_ID'], () => ['https://api.notion.com/v1/databases/' + encodeURIComponent(env.NOTION_DATABASE_ID), { Authorization: 'Bearer ' + env.NOTION_TOKEN, 'Notion-Version': '2022-06-28' }]],
    ['postly', ['POSTLY_API_KEY', 'POSTLY_WORKSPACE_ID'], () => ['https://openapi.postly.ai/v1/workspaces/' + encodeURIComponent(env.POSTLY_WORKSPACE_ID) + '/socials', { 'X-API-Key': env.POSTLY_API_KEY }]],
    ['gumroad', ['GUMROAD_TOKEN'], () => ['https://api.gumroad.com/v2/user?' + new URLSearchParams({ access_token: env.GUMROAD_TOKEN }), {}]],
    ['luma', ['LUMA_API_KEY'], () => ['https://public-api.luma.com/v1/users/get-self', { 'x-luma-api-key': env.LUMA_API_KEY }]],
    ['github', ['GITHUB_TOKEN'], () => ['https://api.github.com/user', { Authorization: 'Bearer ' + env.GITHUB_TOKEN }]],
    ['composio', ['COMPOSIO_API_KEY'], () => ['https://backend.composio.dev/api/v3.1/connected_accounts?limit=100&account_type=ALL', { 'x-api-key': env.COMPOSIO_API_KEY }]],
    ['myskool', ['SKOOL_API_KEY'], () => ['https://api.myskool.xyz/v1/groups', { Authorization: 'Bearer ' + env.SKOOL_API_KEY }]],
  ];
  const results = await Promise.all(checks.map(async ([source, keys, request]) => {
    const missing = keys.filter(key => !env[key]);
    if (missing.length) return { source, state: 'missing_configuration', missing };
    try {
      const [url, headers] = request();
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(20000), redirect: 'error' });
      const body = await response.json().catch(() => null);
      const result = { source, state: response.ok && body && body.success !== false ? 'read_verified' : 'failed', httpStatus: response.status };
      if (source === 'composio' && response.ok) result.accounts = (body?.items || []).map(account => ({ toolkit: account.toolkit?.slug, status: account.status, configured: account.id === env.COMPOSIO_CONNECTED_ACCOUNT_ID }));
      if (source === 'notion' && response.ok) {
        result.propertyCount = Object.keys(body?.properties || {}).length;
        result.sources = body?.properties?.['Source Tags']?.multi_select?.options?.map(option => option.name) || [];
      }
      return result;
    } catch {
      // Do not print URLs, upstream response bodies, or exceptions: they can contain credentials.
      return { source, state: 'network_error' };
    }
  }));
  results.push(...await Promise.all([checkTypefullyConnection(env), checkRedditConnection(env)]));
  if (!env.POSTIZ_API_KEY) results.push({ source: 'postiz', state: 'missing_configuration' });
  else {
    try {
      const base = new URL(env.POSTIZ_API_BASE_URL || 'https://api.postiz.com/public/v1');
      const local = base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
      if ((!local && base.protocol !== 'https:') || base.username || base.password || base.search || base.hash) throw new Error('Invalid base');
      const response = await fetch(base.href.replace(/\/$/, '') + '/integrations', {
        headers: { Authorization: env.POSTIZ_API_KEY }, redirect: 'error', signal: AbortSignal.timeout(20000),
      });
      const body = await response.json().catch(() => null);
      const valid = Array.isArray(body) && body.every(account => typeof account.id === 'string' && typeof account.identifier === 'string' && typeof account.disabled === 'boolean');
      results.push({ source: 'postiz', state: response.ok && valid ? 'read_verified' : 'failed', httpStatus: response.status, ...(valid ? { accounts: body.map(account => ({ id: account.id, channel: account.identifier, connected: !account.disabled })) } : {}) });
    } catch { results.push({ source: 'postiz', state: 'network_error' }); }
  }
  results.push({ source: 'once', state: 'mcp_oauth_not_verified' });
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), scope: 'read-only; publication and subscriptions not verified', results }, null, 2));
  if (results.some(result => result.state !== 'read_verified')) process.exitCode = 1;
}

main().catch(() => { console.error('Connection check failed without exposing configuration.'); process.exitCode = 1; });
