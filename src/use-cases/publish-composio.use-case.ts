import { env } from '../config/env';
import { isDryRun, PublishModeOptions } from '../connectors/dry-run';
import {
  ComposioService,
  extractRedditPermalink,
  isComposioConfigured,
  toEventbriteUtc,
} from '../services/composio.service';
import {
  extractComposioEventbriteContent,
  extractComposioRedditContent,
  getNotionPage,
  updateComposioRedditMetadata,
} from '../services/notion.service';

export type PublishComposioOptions = PublishModeOptions & {
  /** Explicit Reddit post kind; else inferred from Notion fields. */
  kind?: 'self' | 'link';
};

/**
 * Publish Reddit and/or Eventbrite via Composio from Publisher Notion props.
 * Dry-run is the default (exact tool-execute payload, no POST /tools/execute).
 */
export async function executePublishComposioUseCase(
  notion_page_id: string,
  options: PublishComposioOptions = {}
): Promise<void> {
  console.log(
    `[INFO] Composio publish start (notionPageId: ${notion_page_id}, dryRun=${isDryRun(options)})`
  );

  if (!isComposioConfigured()) {
    await updateComposioRedditMetadata(notion_page_id, {
      composio_status: 'Failed',
      final_status: 'Error',
    });
    console.error('[ERROR] COMPOSIO_API_KEY not configured');
    return;
  }

  await updateComposioRedditMetadata(notion_page_id, { composio_status: 'In progress' });

  try {
    const page = await getNotionPage(notion_page_id);
    const props = page?.properties || {};
    const reddit = extractComposioRedditContent(props, { kind: options.kind });
    const eventbrite = extractComposioEventbriteContent(props);
    const channels = reddit.channels.length ? reddit.channels : eventbrite.channels;
    const wantReddit = channels.includes('Reddit');
    const wantEventbrite = channels.includes('Eventbrite');

    if (!wantReddit && !wantEventbrite) {
      await updateComposioRedditMetadata(notion_page_id, {
        composio_status: 'Failed',
        final_status: 'Error',
      });
      console.error(
        `[ERROR] Channels must include Reddit and/or Eventbrite for Composio publish (${notion_page_id})`
      );
      return;
    }

    const userId = reddit.composio_user_id || eventbrite.composio_user_id || env.COMPOSIO_USER_ID;
    if (!userId) {
      await updateComposioRedditMetadata(notion_page_id, {
        composio_status: 'Failed',
        final_status: 'Error',
      });
      console.error(
        `[ERROR] Missing COMPOSIO_USER_ID (env or Notion Composio User ID) for ${notion_page_id}`
      );
      return;
    }

    const composio = new ComposioService();
    const urls: string[] = [];

    if (wantReddit) {
      if (!reddit.is_complete) {
        await updateComposioRedditMetadata(notion_page_id, {
          composio_status: 'Failed',
          final_status: 'Error',
        });
        console.error(
          `[ERROR] Incomplete Composio/Reddit content for ${notion_page_id}: ${reddit.missing.join('; ')}`
        );
        return;
      }

      const connectedAccountId =
        reddit.composio_connected_account_id || env.COMPOSIO_CONNECTED_ACCOUNT_ID || undefined;
      const result = await composio.createRedditPost(
        {
          subreddit: reddit.subreddit,
          title: reddit.title,
          kind: reddit.kind,
          text: reddit.kind === 'self' ? reddit.body : undefined,
          url: reddit.kind === 'link' ? reddit.link_url : undefined,
        },
        { userId, connectedAccountId },
        options
      );

      if (result.dry_run) {
        console.log(
          `[INFO] Composio Reddit dry-run (${notion_page_id}) kind=${reddit.kind} subreddit=${reddit.subreddit}`
        );
      } else if (result.response.successful === false || result.response.error) {
        await updateComposioRedditMetadata(notion_page_id, {
          composio_status: 'Failed',
          final_status: 'Error',
        });
        console.error(
          `[ERROR] Composio Reddit post failed for ${notion_page_id}: ${result.response.error || 'unknown'}`
        );
        return;
      } else {
        const permalink = extractRedditPermalink(result.response);
        if (permalink) urls.push(permalink);
      }
    }

    if (wantEventbrite) {
      if (!eventbrite.is_complete) {
        await updateComposioRedditMetadata(notion_page_id, {
          composio_status: 'Failed',
          final_status: 'Error',
        });
        console.error(
          `[ERROR] Incomplete Composio/Eventbrite content for ${notion_page_id}: ${eventbrite.missing.join('; ')}`
        );
        return;
      }

      const connectedAccountId =
        eventbrite.composio_connected_account_id ||
        env.COMPOSIO_EVENTBRITE_CONNECTED_ACCOUNT_ID ||
        env.COMPOSIO_CONNECTED_ACCOUNT_ID ||
        undefined;

      const result = await composio.createEventbriteEvent(
        {
          organization_id: eventbrite.organization_id,
          name: eventbrite.name,
          start_utc: toEventbriteUtc(eventbrite.start_raw),
          end_utc: toEventbriteUtc(eventbrite.end_raw),
          timezone: eventbrite.timezone,
          currency: eventbrite.currency,
          description_html: eventbrite.description_html || undefined,
          online_event: eventbrite.online_event,
          venue_id: eventbrite.venue_id || undefined,
        },
        { userId, connectedAccountId },
        options
      );

      if (result.dry_run) {
        console.log(
          `[INFO] Composio Eventbrite dry-run (${notion_page_id}) name=${eventbrite.name}`
        );
      } else if (result.response.successful === false || result.response.error) {
        await updateComposioRedditMetadata(notion_page_id, {
          composio_status: 'Failed',
          final_status: 'Error',
        });
        console.error(
          `[ERROR] Composio Eventbrite create failed for ${notion_page_id}: ${result.response.error || 'unknown'}`
        );
        return;
      } else {
        const url = extractEventbriteUrl(result.response.data) || extractEventbriteUrl(result.response.raw);
        if (url) urls.push(url);
      }
    }

    if (isDryRun(options) || env.COMPOSIO_PUBLISH_LIVE !== 'true') {
      return;
    }

    await updateComposioRedditMetadata(notion_page_id, {
      composio_status: 'Published',
      reddit_url: urls.find(u => /reddit\.com/i.test(u)),
      composio_url: urls[0],
      final_status: 'Published',
    });
  } catch (err: any) {
    await updateComposioRedditMetadata(notion_page_id, {
      composio_status: 'Failed',
      final_status: 'Error',
    });
    console.error(`[ERROR] Composio publish exception for ${notion_page_id}: ${err.message}`);
  }
}

function extractEventbriteUrl(node: unknown, depth = 0): string {
  if (!node || depth > 6) return '';
  if (typeof node === 'string') {
    const m = node.match(/https?:\/\/(?:www\.)?eventbrite\.[^\s"'<>]+/i);
    return m ? m[0] : '';
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = extractEventbriteUrl(item, depth + 1);
      if (hit) return hit;
    }
    return '';
  }
  if (typeof node === 'object') {
    const o = node as Record<string, unknown>;
    for (const key of ['url', 'vanity_url', 'eventbrite_url']) {
      if (typeof o[key] === 'string') {
        const hit = extractEventbriteUrl(o[key], depth + 1);
        if (hit) return hit;
      }
    }
    for (const v of Object.values(o)) {
      const hit = extractEventbriteUrl(v, depth + 1);
      if (hit) return hit;
    }
  }
  return '';
}
