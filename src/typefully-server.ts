import 'dotenv/config';
import http from 'node:http';
import { resolve } from 'node:path';
import { createTypefullyWebhook } from './controllers/typefully-webhook.controller';
import { createTypefullyNotionRuntime } from './services/typefully-notion-runtime';

// Independent deployment entry point: never import index.ts or publication schedulers.
const required = ['NOTION_TOKEN', 'NOTION_DATABASE_ID', 'COMPOSIO_API_KEY', 'COMPOSIO_USER_ID', 'COMPOSIO_TYPEFULLY_CONNECTED_ACCOUNT_ID', 'PUBLISHER_WEBHOOK_TOKEN'] as const;
if (required.some(key => !process.env[key]) || (process.env.PUBLISHER_WEBHOOK_TOKEN || '').length < 32) throw new Error('Notion draft service configuration is incomplete');
if (process.env.NODE_ENV === 'production' && !process.env.TYPEFULLY_JOURNAL_DIRECTORY) throw new Error('Production requires a persistent TYPEFULLY_JOURNAL_DIRECTORY');
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const handler = createTypefullyWebhook(process.env.PUBLISHER_WEBHOOK_TOKEN!, createTypefullyNotionRuntime({
  notionToken: process.env.NOTION_TOKEN!, databaseId: process.env.NOTION_DATABASE_ID!,
  composioApiKey: process.env.COMPOSIO_API_KEY!, userId: process.env.COMPOSIO_USER_ID!,
  connectedAccountId: process.env.COMPOSIO_TYPEFULLY_CONNECTED_ACCOUNT_ID!,
  journalDirectory: process.env.TYPEFULLY_JOURNAL_DIRECTORY || resolve(__dirname, '../data/typefully-jobs'),
}));
const server = http.createServer((req, res) => {
  const pathname = req.url?.split('?')[0];
  if (pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ status: 'ok', service: 'open-publisher-notion-drafts' }));
    return;
  }
  if (pathname === '/webhooks/draft-typefully') { void handler(req, res); return; }
  res.writeHead(404); res.end();
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.listen(port, process.env.HOST || '0.0.0.0', () => console.log('Open Publisher Notion draft service listening'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 70000).unref();
});
