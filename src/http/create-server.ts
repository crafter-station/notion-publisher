import http from 'node:http';
import { env } from '../config/env';
import { webhooksController } from '../controllers/webhooks.controller';
import { authorizeWebhookRequest, requireWebhookToken } from './webhook-auth';

export { requireWebhookToken } from './webhook-auth';

export function createPublisherRequestListener(token: string) {
  return async (req: http.IncomingMessage, res: http.ServerResponse) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} accessed.`);
    const path = req.url?.split('?')[0];

    if (req.method === 'POST' && path?.startsWith('/webhooks/')) {
      if (!authorizeWebhookRequest(req, token)) {
        res.writeHead(401, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ error: 'unauthorized' }));
        return;
      }
    }

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
      if (path === '/capabilities/postiz') {
        return webhooksController.handleCapabilitiesPostiz(req, res);
      }
      if (path === '/capabilities/typefully') {
        return webhooksController.handleCapabilitiesTypefully(req, res);
      }
      if (path === '/capabilities/restream') {
        return webhooksController.handleCapabilitiesRestream(req, res);
      }
    }

    if (req.method === 'POST') {
      if (path === '/webhooks/publish') {
        return webhooksController.handlePublish(req, res);
      }
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
      if (path === '/webhooks/publish-postiz') {
        return webhooksController.handlePublishPostiz(req, res);
      }
      if (path === '/webhooks/publish-typefully') {
        return webhooksController.handlePublishTypefully(req, res);
      }
      if (path === '/webhooks/publish-restream') {
        return webhooksController.handlePublishRestream(req, res);
      }
    }

    res.writeHead(404);
    res.end('Not Found');
  };
}

export function startPublisherHttpServer(port: number, token = env.WEBHOOK_TOKEN) {
  const verified = requireWebhookToken(token);
  listen(port, verified);
}

function listen(port: number, token: string) {
  const server = http.createServer(createPublisherRequestListener(token));

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, trying ${port + 1}...`);
      listen(port + 1, token);
    } else {
      console.error('Server error:', err);
    }
  });

  server.listen(port, () => {
    console.log(`Gumroad Webhook Orchestrator listening on port ${port}`);
  });
}
