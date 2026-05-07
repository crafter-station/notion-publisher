import { IncomingMessage, ServerResponse } from 'http';
import { executePublishProductUseCase } from '../use-cases/publish-product.use-case';
import { executeUnpublishProductUseCase } from '../use-cases/unpublish-product.use-case';
import { executePublishExistingProductUseCase } from '../use-cases/publish-existing.use-case';
import { executePublishPostlyUseCase } from '../use-cases/publish-postly.use-case';
import { PublishGumroadWebhookDto } from '../dtos/webhook.dto';

export const webhooksController = {
  // ... (previous methods)
  async handlePublishPostly(req: IncomingMessage, res: ServerResponse) {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        
        // Handle native Notion automation payload
        const notion_page_id = payload.data?.id;
        
        if (!notion_page_id) {
          res.writeHead(400);
          return res.end(JSON.stringify({ error: 'Missing data.id in Notion webhook payload' }));
        }

        const props = payload.data?.properties || {};
        
        // Extract Caption
        let caption = '';
        if (props['Instagram Caption']?.rich_text?.length > 0) {
          caption = props['Instagram Caption'].rich_text.map((t: any) => t.plain_text).join('');
        }

        // Extract Media URL
        let media_url = '';
        const videoProp = props['Video']?.files;
        if (videoProp && videoProp.length > 0) {
          const fileObj = videoProp[0];
          media_url = fileObj.type === 'external' ? fileObj.external?.url : fileObj.file?.url;
        }

        if (!caption || !media_url) {
          console.error(`[ERROR] Missing Instagram Caption or Video for Notion page: ${notion_page_id}`);
          const { updatePostlyMetadata } = require('../services/notion.service');
          // Update Notion to Failed so the user knows something was missing
          updatePostlyMetadata(notion_page_id, { instagram_status: 'Failed' }).catch((err: any) => {
            console.error('[ERROR] Could not update Notion status to Failed on missing media/caption', err);
          });
          res.writeHead(400);
          return res.end(JSON.stringify({ error: 'Missing Instagram Caption or Video in Notion page' }));
        }

        const { env } = require('../config/env');
        const workspace_id = env.POSTLY_WORKSPACE_ID;
        const allPlatforms = env.POSTLY_TARGET_PLATFORMS.split(',').map((p: string) => p.trim());
        let target_platforms = allPlatforms;

        // Parse query params to select specific target platforms by index
        const reqUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        const targetQuery = reqUrl.searchParams.get('target');

        if (targetQuery) {
          const indices = targetQuery.split(',').map(i => parseInt(i.trim(), 10)).filter(i => !isNaN(i));
          target_platforms = indices.map(i => allPlatforms[i]).filter(Boolean);
          
          if (target_platforms.length === 0) {
            res.writeHead(400);
            return res.end(JSON.stringify({ error: 'Invalid target indices provided in URL' }));
          }
        }

        const useCaseParams = {
          workspace_id,
          target_platforms,
          caption,
          media_url,
          notion_page_id
        };

        console.log(`[INFO] Starting background job for executePublishPostlyUseCase (notionPageId: ${notion_page_id}, platforms: ${target_platforms.length})`);
        executePublishPostlyUseCase(useCaseParams).catch(err => {
          console.error('[ERROR] Postly background job failed', err);
        });

        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Accepted social publishing task', notion_page_id }));
      } catch (err: any) {
        console.error('[ERROR] Synchronous error in handlePublishPostly:', err.message);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  },

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