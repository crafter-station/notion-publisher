import { IncomingMessage, ServerResponse } from 'http';
import { executePublishProductUseCase } from '../use-cases/publish-product.use-case';
import { executeUnpublishProductUseCase } from '../use-cases/unpublish-product.use-case';
import { executePublishExistingProductUseCase } from '../use-cases/publish-existing.use-case';
import { executePublishPostlyUseCase } from '../use-cases/publish-postly.use-case';
import { executePublishLumaUseCase } from '../use-cases/publish-luma.use-case';
import { executePublishGithubUseCase } from '../use-cases/publish-github.use-case';
import { executePublishComposioUseCase } from '../use-cases/publish-composio.use-case';
import { PublishGumroadWebhookDto } from '../dtos/webhook.dto';
import { resolveDefaultPostlyTargetPlatforms } from '../services/postly-targets.service';
import { getCapabilitiesSnapshot } from '../capabilities/registry';
import { PostlyService } from '../services/postly.service';
import { isSkoolConfigured, SkoolService } from '../services/skool.service';
import { isLumaConfigured } from '../services/luma.service';
import { ComposioService, isComposioConfigured } from '../services/composio.service';
import {
  GITHUB_CATALOG_OWNERS,
  GITHUB_PRODUCT_OWNER,
  GithubService,
  isGithubConfigured,
} from '../services/github.service';
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

  /** MySkool read/discover (no publish). */
  async handleCapabilitiesSkool(_req: IncomingMessage, res: ServerResponse) {
    if (!isSkoolConfigured()) {
      return json(res, 200, {
        status: 'stub',
        distributor: 'myskool',
        message: 'Set SKOOL_API_KEY (sk_live_…) from https://myskool.xyz to enable discover.',
        implemented: [
          'GET /v1/groups',
          'GET /v1/groups/:gid',
          'GET /v1/groups/:gid/posts',
          'GET /v1/posts/:id',
          'GET /v1/posts/:id/comments',
        ],
        planned_upstream: ['POST /v1/posts', 'POST comments', 'members', 'courses/events'],
        docs: 'https://myskool.xyz/docs',
      });
    }

    try {
      const skool = new SkoolService();
      const groupsRaw = await skool.listGroups();
      const groups = (Array.isArray(groupsRaw) ? groupsRaw : []).map((g: any) => ({
        id: g.id || g.gid || g.group_id,
        name: g.name || g.title || g.slug,
        slug: g.slug,
      }));

      const preferred =
        env.SKOOL_GROUP_ID ||
        groups[0]?.id ||
        null;

      let sample_posts: any[] | undefined;
      if (preferred) {
        const postsRaw = await skool.listGroupPosts(String(preferred), 1);
        const posts = Array.isArray(postsRaw) ? postsRaw : [];
        sample_posts = posts.slice(0, 5).map((p: any) => ({
          id: p.id || p.post_id,
          title: p.title || p.name,
          created_at: p.created_at || p.createdAt,
        }));
      }

      json(res, 200, {
        status: 'discover',
        distributor: 'myskool',
        groups_count: groups.length,
        groups,
        sample_group_id: preferred,
        sample_posts,
        note: 'Read-only. Create/publish to Skool is upstream Phase 2 — no webhook yet.',
        docs: 'https://myskool.xyz/docs',
      });
    } catch (err: any) {
      json(res, 502, {
        status: 'error',
        distributor: 'myskool',
        error: err.message || String(err),
      });
    }
  },

  /** GitHub catalog discover (metadata). Releases via publish-github. */
  async handleCapabilitiesGithub(req: IncomingMessage, res: ServerResponse) {
    if (!isGithubConfigured()) {
      return json(res, 200, {
        status: 'stub',
        distributor: 'github',
        message: 'Set GITHUB_TOKEN to enable catalog / Releases.',
        product_owner: GITHUB_PRODUCT_OWNER,
        catalog_owners: GITHUB_CATALOG_OWNERS,
      });
    }

    try {
      const reqUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const owner = reqUrl.searchParams.get('owner') || GITHUB_PRODUCT_OWNER;
      const gh = new GithubService();
      const repos = await gh.listReposForOwner(owner);
      json(res, 200, {
        status: 'discover',
        distributor: 'github',
        product_owner: GITHUB_PRODUCT_OWNER,
        catalog_owners: GITHUB_CATALOG_OWNERS,
        owner,
        repos_count: repos.length,
        repos: repos.slice(0, 30).map(r => ({
          full_name: r.full_name,
          html_url: r.html_url,
          private: r.private,
          description: r.description?.slice(0, 120),
        })),
        note: `Product Releases only under ${GITHUB_PRODUCT_OWNER}. Import: npm run github:import-repos -- --owner=${owner}`,
      });
    } catch (err: any) {
      json(res, 502, {
        status: 'error',
        distributor: 'github',
        error: err.message || String(err),
      });
    }
  },

  /** Composio connected accounts (Reddit live; Eventbrite pending). */
  async handleCapabilitiesComposio(_req: IncomingMessage, res: ServerResponse) {
    if (!isComposioConfigured()) {
      return json(res, 200, {
        status: 'stub',
        distributor: 'composio',
        message: 'Set COMPOSIO_API_KEY to enable Reddit publish / account discover.',
        eventbrite: 'pending_connect',
      });
    }

    try {
      const composio = new ComposioService();
      const [redditAccounts, eventbriteAccounts] = await Promise.all([
        composio.listConnectedAccounts({ toolkit: 'reddit' }),
        composio.listConnectedAccounts({ toolkit: 'eventbrite' }),
      ]);
      const redditOk = redditAccounts.some(
        a => !a.status || /ACTIVE|active|ENABLED|enabled/i.test(String(a.status))
      );

      json(res, 200, {
        status: redditOk ? 'live' : 'discover',
        distributor: 'composio',
        reddit: {
          connected: redditOk,
          accounts: redditAccounts,
          hint: 'Set COMPOSIO_USER_ID + COMPOSIO_CONNECTED_ACCOUNT_ID from accounts[]',
        },
        eventbrite: {
          connected: eventbriteAccounts.length > 0,
          accounts: eventbriteAccounts,
          status: eventbriteAccounts.length ? 'discover' : 'pending_connect',
          note: 'Write deferred until Eventbrite connected in Composio dashboard.',
        },
        webhook: 'POST /webhooks/publish-composio',
      });
    } catch (err: any) {
      json(res, 502, {
        status: 'error',
        distributor: 'composio',
        error: err.message || String(err),
      });
    }
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
            postly_status: 'Failed',
            final_status: 'Error',
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

  async handlePublishLuma(req: IncomingMessage, res: ServerResponse) {
    let body = '';
    req.on('data', chunk => (body += chunk.toString()));
    req.on('end', async () => {
      try {
        if (!isLumaConfigured()) {
          res.writeHead(503);
          return res.end(
            JSON.stringify({
              error: 'LUMA_API_KEY not configured',
              docs: 'https://docs.luma.com/reference/getting-started-with-your-api',
            })
          );
        }

        const payload = JSON.parse(body || '{}');
        const notion_page_id = payload.data?.id;
        if (!notion_page_id) {
          res.writeHead(400);
          return res.end(JSON.stringify({ error: 'Missing data.id in Notion webhook payload' }));
        }

        const {
          extractLumaContent,
          getNotionPage,
          updateLumaMetadata,
        } = require('../services/notion.service');
        const pageData = await getNotionPage(notion_page_id).catch((err: any) => {
          console.warn(
            `[WARN] Could not fetch full Notion page for ${notion_page_id}; using webhook payload properties.`,
            err
          );
          return payload.data;
        });
        const props = pageData?.properties || payload.data?.properties || {};
        const content = extractLumaContent(props);

        if (!content.is_complete) {
          console.error(
            `[ERROR] Incomplete Luma content for ${notion_page_id}: ${content.missing.join('; ')}`
          );
          updateLumaMetadata(notion_page_id, {
            luma_status: 'Failed',
            final_status: 'Error',
          }).catch((err: any) => {
            console.error('[ERROR] Could not update Notion on incomplete Luma content', err);
          });
          res.writeHead(400);
          return res.end(
            JSON.stringify({ error: 'Incomplete Notion content', missing: content.missing })
          );
        }

        console.log(`[INFO] Starting Luma background job (notionPageId: ${notion_page_id})`);
        executePublishLumaUseCase(notion_page_id).catch(err => {
          console.error('[ERROR] Luma background job failed', err);
        });

        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            message: 'Accepted Luma event create task',
            notion_page_id,
            name: content.name,
            start_at: content.start_at,
          })
        );
      } catch (err: any) {
        console.error('[ERROR] Synchronous error in handlePublishLuma:', err.message);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  },

  async handlePublishGithub(req: IncomingMessage, res: ServerResponse) {
    let body = '';
    req.on('data', chunk => (body += chunk.toString()));
    req.on('end', async () => {
      try {
        if (!isGithubConfigured()) {
          res.writeHead(503);
          return res.end(JSON.stringify({ error: 'GITHUB_TOKEN not configured' }));
        }

        const payload = JSON.parse(body || '{}');
        const notion_page_id = payload.data?.id;
        if (!notion_page_id) {
          res.writeHead(400);
          return res.end(JSON.stringify({ error: 'Missing data.id in Notion webhook payload' }));
        }

        const {
          extractGithubPublishContent,
          getNotionPage,
          updateGithubMetadata,
        } = require('../services/notion.service');
        const pageData = await getNotionPage(notion_page_id).catch((err: any) => {
          console.warn(`[WARN] Notion fetch failed for ${notion_page_id}`, err);
          return payload.data;
        });
        const props = pageData?.properties || payload.data?.properties || {};
        const content = extractGithubPublishContent(props);

        if (!content.is_complete) {
          updateGithubMetadata(notion_page_id, {
            github_status: 'Failed',
            final_status: 'Error',
          }).catch(() => undefined);
          res.writeHead(400);
          return res.end(
            JSON.stringify({ error: 'Incomplete Notion content', missing: content.missing })
          );
        }

        if (content.owner !== GITHUB_PRODUCT_OWNER) {
          res.writeHead(403);
          return res.end(
            JSON.stringify({
              error: `Product Releases only under ${GITHUB_PRODUCT_OWNER}`,
              got: content.owner,
            })
          );
        }

        const reqUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        const draft = reqUrl.searchParams.get('draft') === 'true';

        console.log(
          `[INFO] Starting GitHub background job (notionPageId: ${notion_page_id}, repo: ${content.full_name}, draft: ${draft})`
        );
        executePublishGithubUseCase(notion_page_id, { draft }).catch(err => {
          console.error('[ERROR] GitHub background job failed', err);
        });

        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            message: 'Accepted GitHub release task',
            notion_page_id,
            repo: content.full_name,
            tag: content.tag,
            draft,
          })
        );
      } catch (err: any) {
        console.error('[ERROR] Synchronous error in handlePublishGithub:', err.message);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  },

  async handlePublishComposio(req: IncomingMessage, res: ServerResponse) {
    let body = '';
    req.on('data', chunk => (body += chunk.toString()));
    req.on('end', async () => {
      try {
        if (!isComposioConfigured()) {
          res.writeHead(503);
          return res.end(
            JSON.stringify({
              error: 'COMPOSIO_API_KEY not configured',
              docs: 'https://docs.composio.dev/',
            })
          );
        }

        const payload = JSON.parse(body || '{}');
        const notion_page_id = payload.data?.id || payload.notion_page_id;
        if (!notion_page_id) {
          res.writeHead(400);
          return res.end(
            JSON.stringify({
              error: 'Missing data.id (Notion webhook) or notion_page_id',
            })
          );
        }

        const {
          extractComposioRedditContent,
          getNotionPage,
          updateComposioRedditMetadata,
        } = require('../services/notion.service');
        const pageData = await getNotionPage(notion_page_id).catch((err: any) => {
          console.warn(`[WARN] Notion fetch failed for ${notion_page_id}`, err);
          return payload.data;
        });
        const props = pageData?.properties || payload.data?.properties || {};

        const reqUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        const kindParam = reqUrl.searchParams.get('kind');
        const kind =
          kindParam === 'self' || kindParam === 'link'
            ? (kindParam as 'self' | 'link')
            : undefined;

        const content = extractComposioRedditContent(props, { kind });

        if (!content.channels.includes('Reddit') && content.channels.includes('Eventbrite')) {
          res.writeHead(503);
          return res.end(
            JSON.stringify({
              error: 'Eventbrite via Composio not connected yet',
              action: 'Connect Eventbrite in Composio dashboard, then retry',
            })
          );
        }

        if (!content.is_complete) {
          updateComposioRedditMetadata(notion_page_id, {
            composio_status: 'Failed',
            final_status: 'Error',
          }).catch(() => undefined);
          res.writeHead(400);
          return res.end(
            JSON.stringify({ error: 'Incomplete Notion content', missing: content.missing })
          );
        }

        console.log(
          `[INFO] Starting Composio background job (notionPageId: ${notion_page_id}, kind: ${content.kind})`
        );
        executePublishComposioUseCase(notion_page_id, { kind }).catch(err => {
          console.error('[ERROR] Composio background job failed', err);
        });

        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            message: 'Accepted Composio Reddit publish task',
            notion_page_id,
            kind: content.kind,
            subreddit: content.subreddit,
            title: content.title,
          })
        );
      } catch (err: any) {
        console.error('[ERROR] Synchronous error in handlePublishComposio:', err.message);
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
