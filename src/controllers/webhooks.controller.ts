import { IncomingMessage, ServerResponse } from 'http';
import { executePublishProductUseCase } from '../use-cases/publish-product.use-case';
import { executeUnpublishProductUseCase } from '../use-cases/unpublish-product.use-case';
import { executePublishExistingProductUseCase } from '../use-cases/publish-existing.use-case';
import { executePublishPostlyUseCase } from '../use-cases/publish-postly.use-case';
import { PublishGumroadWebhookDto } from '../dtos/webhook.dto';
import { resolveDefaultPostlyTargetPlatforms } from '../services/postly-targets.service';
import { getCapabilitiesSnapshot } from '../capabilities/registry';
import { PostlyService } from '../services/postly.service';
import { env } from '../config/env';

function getHeaderValue(req: IncomingMessage, name: string) {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

export const webhooksController = {
  /** Static distributor + Postly platform catalog (no network). */
  async handleCapabilities(_req: IncomingMessage, res: ServerResponse) {
    json(res, 200, getCapabilitiesSnapshot());
  },

  /** Live Postly socials + audience groups (read-only, no publish). */
  async handleCapabilitiesPostly(_req: IncomingMessage, res: ServerResponse) {
    try {
      const postly = new PostlyService();
      const workspace_id = env.POSTLY_WORKSPACE_ID;
      const [socials, audience_groups] = await Promise.all([
        postly.listSocials(workspace_id),
        postly.listAudienceGroups(workspace_id),
      ]);

      const channels = (socials as any[])
        .filter(s => s.target)
        .map(s => ({
          id: s.id || s.channel_id,
          name: s.name,
          target: s.target,
          connected: s.connected,
          parent_id: s.parent_id,
        }));

      const groups = (audience_groups as any[]).map(g => ({
        id: g.id || g._id || g.audience_group_id,
        name: g.name,
        channel_count: g.channel_count ?? (g.channels || []).length,
        channel_ids: g.channel_ids || (g.channels || []).map((c: any) => c.id),
        targets: (g.channels || []).map((c: any) => c.target).filter(Boolean),
      }));

      json(res, 200, {
        workspace_id,
        configured_target_platforms: env.POSTLY_TARGET_PLATFORMS,
        audience_group_env: env.POSTLY_AUDIENCE_GROUP || null,
        socials_count: channels.length,
        socials: channels,
        audience_groups: groups,
        note: 'Read-only discovery. Publish path unchanged; audience_group not applied unless you opt in later.',
      });
    } catch (err: any) {
      json(res, 500, { error: err.message || String(err) });
    }
  },

  async handlePublishPostly(req: IncomingMessage, res: ServerResponse) {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);

        const notion_page_id = payload.data?.id;
        if (!notion_page_id) {
          res.writeHead(400);
          return res.end(JSON.stringify({ error: 'Missing data.id in Notion webhook payload' }));
        }

        const { extractPostlyContent, getNotionPage, updatePostlyMetadata } = require('../services/notion.service');
        const pageData = await getNotionPage(notion_page_id).catch((err: any) => {
          console.warn(`[WARN] Could not fetch full Notion page for ${notion_page_id}; using webhook payload properties.`, err);
          return payload.data;
        });
        const props = pageData?.properties || payload.data?.properties || {};
        const content = extractPostlyContent(props);

        if (!content.is_complete) {
          console.error(`[ERROR] Incomplete Postly content for ${notion_page_id}: ${content.missing.join('; ')}`);
          updatePostlyMetadata(notion_page_id, {
            instagram_status: 'Failed',
            final_status: 'Postly Error',
            post_id: `Missing: ${content.missing.join('; ')}`,
          }).catch((err: any) => {
            console.error('[ERROR] Could not update Notion on incomplete content', err);
          });
          res.writeHead(400);
          return res.end(JSON.stringify({ error: 'Incomplete Notion content', missing: content.missing }));
        }

        const workspace_id = getHeaderValue(req, 'workspace_id') || env.POSTLY_WORKSPACE_ID;
        const allPlatforms = resolveDefaultPostlyTargetPlatforms();
        let target_platforms = allPlatforms;

        // Optional: `?target=0,2,5` subsets platforms by index
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

        console.log(`[INFO] Starting Postly background job (notionPageId: ${notion_page_id}, brand: ${content.brand || 'n/a'}, targetSource: POSTLY_TARGET_PLATFORMS, platforms: ${target_platforms.length})`);
        executePublishPostlyUseCase({
          workspace_id,
          target_platforms,
          content,
          notion_page_id,
        }).catch(err => {
          console.error('[ERROR] Postly background job failed', err);
        });

        const overrides = Object.entries({
          instagram: !!content.caption_instagram,
          facebook: !!content.caption_facebook,
          linkedin: !!content.caption_linkedin,
          tiktok: !!content.caption_tiktok,
          threads: !!content.caption_threads,
          pinterest: !!(content.pinterest_title || content.pinterest_description),
          youtube: !!(content.youtube_title || content.youtube_caption),
        }).filter(([_, v]) => v).map(([k]) => k);

        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          message: 'Accepted social publishing task',
          notion_page_id,
          platforms_count: target_platforms.length,
          per_platform_overrides: overrides,
        }));
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
