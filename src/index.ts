import http from 'http';
import { resolve } from 'node:path';
import { createTypefullyWebhook } from './controllers/typefully-webhook.controller';
import { createTypefullyNotionRuntime } from './services/typefully-notion-runtime';
import { env } from './config/env';
import { webhooksController } from './controllers/webhooks.controller';
import { startGumroadAutopilotScheduler } from './schedulers/gumroad-autopilot.scheduler';
import { startPostlyQueueScheduler } from './schedulers/postly-queue.scheduler';

const typefullyWebhook = createTypefullyWebhook(env.PUBLISHER_WEBHOOK_TOKEN,
  createTypefullyNotionRuntime({
    notionToken: env.NOTION_TOKEN, databaseId: env.NOTION_DATABASE_ID || '',
    composioApiKey: env.COMPOSIO_API_KEY, userId: env.COMPOSIO_USER_ID,
    connectedAccountId: env.COMPOSIO_TYPEFULLY_CONNECTED_ACCOUNT_ID,
    journalDirectory: env.TYPEFULLY_JOURNAL_DIRECTORY || resolve(__dirname, '../data/typefully-jobs'),
  }));
let currentPort = env.PORT;

// Simple Node.js HTTP server. Ready to deploy to Render / Heroku / AWS.
function startServer(port: number) {
  // Create a fresh server instance for each attempt
  const server = http.createServer(async (req, res) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} accessed.`);
    const path = req.url?.split('?')[0];

    if (path === '/webhooks/draft-typefully') return typefullyWebhook(req, res);

    if (req.method === 'GET') {
      if (path === '/capabilities') {
        return webhooksController.handleCapabilities(req, res);
      }
      if (path === '/capabilities/postly') {
        return webhooksController.handleCapabilitiesPostly(req, res);
      }
      if (path === '/capabilities/skool') {
        return webhooksController.handleCapabilitiesSkool(req, res);
      }
      if (path === '/capabilities/github') {
        return webhooksController.handleCapabilitiesGithub(req, res);
      }
      if (path === '/capabilities/composio') {
        return webhooksController.handleCapabilitiesComposio(req, res);
      }
    }

    if (req.method === 'POST') {
      if (path === '/webhooks/publish-gumroad') {
        return webhooksController.handlePublishGumroad(req, res);
      }
      if (path === '/webhooks/unpublish-gumroad') {
        return webhooksController.handleUnpublishGumroad(req, res);
      }
      if (path === '/webhooks/publish-postly') {
        return webhooksController.handlePublishPostly(req, res);
      }
      if (path === '/webhooks/publish-luma') {
        return webhooksController.handlePublishLuma(req, res);
      }
      if (path === '/webhooks/publish-github') {
        return webhooksController.handlePublishGithub(req, res);
      }
      if (path === '/webhooks/publish-composio') {
        return webhooksController.handlePublishComposio(req, res);
      }
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });

  server.listen(port, () => {
    console.log(`Gumroad Webhook Orchestrator listening on port ${port}`);
  });
}

startServer(currentPort);
startGumroadAutopilotScheduler();
startPostlyQueueScheduler();
