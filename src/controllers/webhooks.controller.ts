import { IncomingMessage, ServerResponse } from 'http';
import { executePublishProductUseCase } from '../use-cases/publish-product.use-case';
import { executeUnpublishProductUseCase } from '../use-cases/unpublish-product.use-case';
import { executePublishExistingProductUseCase } from '../use-cases/publish-existing.use-case';
import { PublishGumroadWebhookDto } from '../dtos/webhook.dto';

export const webhooksController = {
  async handlePublishGumroad(req: IncomingMessage, res: ServerResponse) {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const payload: PublishGumroadWebhookDto = JSON.parse(body);

        const notionPageId = payload.data?.id;

        if (!notionPageId) {
          res.writeHead(400);
          return res.end(JSON.stringify({ error: 'Missing data.id in Notion webhook payload' }));
        }

        // In a true enterprise setup, this might be sent to a BullMQ/SQS queue
        console.log(`[INFO] Starting background job for executePublishProductUseCase (notionPageId: ${notionPageId})`);
        executePublishProductUseCase(notionPageId, payload.data).catch(err => {
          console.error('[ERROR] Background job failed', err);
        });

        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Accepted creation task', notionPageId }));
      } catch (err: any) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  },

  async handlePublishExistingGumroad(req: IncomingMessage, res: ServerResponse) {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const payload: PublishGumroadWebhookDto = JSON.parse(body);

        const notionPageId = payload.data?.id;

        if (!notionPageId) {
          res.writeHead(400);
          return res.end(JSON.stringify({ error: 'Missing data.id in Notion webhook payload' }));
        }

        console.log(`[INFO] Starting background job for executePublishExistingProductUseCase (notionPageId: ${notionPageId})`);
        executePublishExistingProductUseCase(notionPageId, payload.data).catch(err => {
          console.error('[ERROR] Background job failed', err);
        });

        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Accepted publish task', notionPageId }));
      } catch (err: any) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  },

  async handleUnpublishGumroad(req: IncomingMessage, res: ServerResponse) {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const payload: PublishGumroadWebhookDto = JSON.parse(body);

        const notionPageId = payload.data?.id;

        if (!notionPageId) {
          res.writeHead(400);
          return res.end(JSON.stringify({ error: 'Missing data.id in Notion webhook payload' }));
        }

        console.log(`[INFO] Starting background job for executeUnpublishProductUseCase (notionPageId: ${notionPageId})`);
        executeUnpublishProductUseCase(notionPageId, payload.data).catch(err => {
          console.error('[ERROR] Background job failed', err);
        });

        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Accepted unpublish task', notionPageId }));
      } catch (err: any) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }
};