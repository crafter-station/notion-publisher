import { env } from '../config/env';
import {
  ComposioService,
  extractRedditPermalink,
  isComposioConfigured,
} from '../services/composio.service';
import {
  extractComposioRedditContent,
  getNotionPage,
  updateComposioRedditMetadata,
} from '../services/notion.service';

export type PublishComposioOptions = {
  /** Explicit post kind; else inferred from Notion fields. */
  kind?: 'self' | 'link';
};

/**
 * Publish Reddit via Composio from Publisher Notion props; write back status + URLs.
 * Eventbrite: deferred until toolkit connected in Composio.
 */
export async function executePublishComposioUseCase(
  notion_page_id: string,
  options: PublishComposioOptions = {}
): Promise<void> {
  console.log(`[INFO] Composio publish start (notionPageId: ${notion_page_id})`);

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
    const content = extractComposioRedditContent(props, { kind: options.kind });

    if (content.channels.includes('Eventbrite') && !content.channels.includes('Reddit')) {
      await updateComposioRedditMetadata(notion_page_id, {
        composio_status: 'Failed',
        final_status: 'Error',
      });
      console.error(
        `[ERROR] Eventbrite via Composio not connected yet — connect Eventbrite in Composio dashboard first (${notion_page_id})`
      );
      return;
    }

    if (!content.channels.includes('Reddit')) {
      await updateComposioRedditMetadata(notion_page_id, {
        composio_status: 'Failed',
        final_status: 'Error',
      });
      console.error(
        `[ERROR] Channels must include Reddit for Composio publish (${notion_page_id})`
      );
      return;
    }

    if (!content.is_complete) {
      await updateComposioRedditMetadata(notion_page_id, {
        composio_status: 'Failed',
        final_status: 'Error',
      });
      console.error(
        `[ERROR] Incomplete Composio/Reddit content for ${notion_page_id}: ${content.missing.join('; ')}`
      );
      return;
    }

    const userId = content.composio_user_id || env.COMPOSIO_USER_ID;
    const connectedAccountId =
      content.composio_connected_account_id || env.COMPOSIO_CONNECTED_ACCOUNT_ID || undefined;

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
    const result = await composio.createRedditPost(
      {
        subreddit: content.subreddit,
        title: content.title,
        kind: content.kind,
        text: content.kind === 'self' ? content.body : undefined,
        url: content.kind === 'link' ? content.link_url : undefined,
      },
      { userId, connectedAccountId }
    );

    if (result.successful === false || result.error) {
      await updateComposioRedditMetadata(notion_page_id, {
        composio_status: 'Failed',
        final_status: 'Error',
      });
      console.error(
        `[ERROR] Composio Reddit post failed for ${notion_page_id}: ${result.error || 'unknown'}`
      );
      return;
    }

    const permalink = extractRedditPermalink(result);
    await updateComposioRedditMetadata(notion_page_id, {
      composio_status: 'Published',
      reddit_url: permalink || undefined,
      composio_url: permalink || undefined,
      final_status: 'Published',
    });

    console.log(
      `[INFO] Composio Reddit published (${notion_page_id}) kind=${content.kind} url=${permalink || '(no permalink parsed)'}`
    );
  } catch (err: any) {
    await updateComposioRedditMetadata(notion_page_id, {
      composio_status: 'Failed',
      final_status: 'Error',
    });
    console.error(`[ERROR] Composio publish exception for ${notion_page_id}: ${err.message}`);
  }
}
