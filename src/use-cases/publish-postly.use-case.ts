import { PostlyService } from '../services/postly.service';
import { updatePostlyMetadata, PostlyContent, FinalStatus, InstagramStatus } from '../services/notion.service';

export interface PublishPostlyParams {
  workspace_id: string;
  target_platforms: string[];
  content: PostlyContent;
  notion_page_id: string;
}

const POLLING_SCHEDULE_SECONDS = [30, 10, 20, 30, 40, 50, 60];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Build platform_posts array for Postly. Each entry overrides the global text
 * for that platform identifier when the AI POVs row has a dedicated caption.
 * Empty settings keys are omitted. Postly may ignore unsupported keys; the
 * global `text` remains the safe fallback.
 */
function buildPlatformPosts(content: PostlyContent) {
  const out: Array<{ identifier: string; settings: Record<string, any> }> = [];
  const push = (identifier: string, settings: Record<string, any>) => {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(settings)) {
      if (v !== undefined && v !== null && v !== '') clean[k] = v;
    }
    if (Object.keys(clean).length > 0) out.push({ identifier, settings: clean });
  };

  push('instagram', { text: content.caption_instagram, first_comment: content.first_comment });
  push('facebook', { text: content.caption_facebook, first_comment: content.first_comment });
  push('linkedin', { text: content.caption_linkedin, first_comment: content.first_comment });
  push('tiktok', { text: content.caption_tiktok });
  push('threads', { text: content.caption_threads });
  push('pinterest', { text: content.pinterest_description, title: content.pinterest_title });
  push('youtube', { text: content.youtube_caption, title: content.youtube_title });

  return out;
}

export async function executePublishPostlyUseCase(params: PublishPostlyParams) {
  const postly = new PostlyService();
  const { notion_page_id, workspace_id, target_platforms, content } = params;

  try {
    console.log(`[POSTLY-USE-CASE] Starting pipeline for Notion page: ${notion_page_id}`);
    console.log(`[POSTLY-USE-CASE] Target platforms (${target_platforms.length}): ${target_platforms.join(', ')}`);
    console.log(`[POSTLY-USE-CASE] Media: ${content.media_type} ${content.media_url}`);

    // PHASE 1 — Mark in-progress on Notion
    await updatePostlyMetadata(notion_page_id, { instagram_status: 'In progress' });

    // PHASE 2 — Build payload and send
    const platform_posts = buildPlatformPosts(content);
    console.log(`[POSTLY-USE-CASE] Phase 2: posting (${platform_posts.length} per-platform overrides)`);

    await postly.createPost({
      workspace: workspace_id,
      target_platforms,
      text: content.global_text,
      media: content.media_url
        ? [{ url: content.media_url, type: content.media_type }]
        : [],
      platform_posts,
    });

    console.log(`[POSTLY-USE-CASE] Post accepted. Waiting 3s to fetch its internal ID...`);
    await delay(3000);

    const recentPosts = await postly.listPosts(workspace_id);
    const createdPost = findMatchingPost(recentPosts, content.global_text, content.media_url);

    if (!createdPost || !createdPost._id) {
      throw new Error("Could not find the newly created post's ID in Postly via list matching.");
    }

    const internal_post_id = createdPost._id;
    console.log(`[POSTLY-USE-CASE] Post found. Internal ID: ${internal_post_id}`);

    // PHASE 3 — Polling loop
    let finalResults: any[] = [];
    let currentAttempt = 0;
    let isResolved = false;

    for (const waitTime of POLLING_SCHEDULE_SECONDS) {
      currentAttempt++;
      console.log(`[POSTLY-USE-CASE] Phase 3: wait ${waitTime}s before attempt ${currentAttempt}`);
      await delay(waitTime * 1000);

      const postStatus = await postly.getPost(workspace_id, internal_post_id);
      if (!postStatus) {
        console.warn(`[POSTLY-USE-CASE] Post ${internal_post_id} not found. Retrying...`);
        continue;
      }

      // PHASE 4 — Normalize per-platform results
      finalResults = normalizePostlyResults(postStatus, target_platforms);
      const unresolved = finalResults.filter(r => r.status === 'pending');
      if (unresolved.length === 0) {
        console.log(`[POSTLY-USE-CASE] All platforms resolved.`);
        isResolved = true;
        break;
      }
      console.log(`[POSTLY-USE-CASE] ${unresolved.length}/${finalResults.length} pending. Continuing...`);
    }

    // PHASE 5 — Fallback match
    if (!isResolved) {
      console.log(`[POSTLY-USE-CASE] Phase 5: fallback match`);
      const allPosts = await postly.listPosts(workspace_id);
      const match = findMatchingPost(allPosts, content.global_text, content.media_url);
      if (match) {
        finalResults = normalizePostlyResults(match, target_platforms);
        isResolved = finalResults.every(r => r.status !== 'pending');
      }
    }

    // PHASE 6 — Aggregate and update Notion
    const publishedResults = finalResults.filter(r => r.status === 'published');
    const failedResults = finalResults.filter(r => r.status === 'failed');

    let instagramStatus: InstagramStatus = 'Published';
    let finalStatus: FinalStatus = 'Published (EN)';

    if (publishedResults.length === 0) {
      instagramStatus = 'Failed';
      finalStatus = 'Postly Error';
    } else if (failedResults.length > 0 || publishedResults.length < target_platforms.length) {
      // Partial — at least one published, at least one failed/pending. No "Partial" enum, mark Failed.
      instagramStatus = 'Failed';
      finalStatus = 'Postly Error';
    }

    // First IG URL goes to `Instagram URL`; fallback to any first published URL
    const igResult = publishedResults.find(r => r.platform_name === 'instagram');
    const firstUrl = igResult?.url || publishedResults[0]?.url;

    // Multi-line "<platform>: <post_id|error>" string for Post ID column
    const postIdLog = finalResults
      .map(r => {
        const id = r.external_id || (r.error ? `ERR: ${String(r.error).slice(0, 100)}` : r.status);
        return `${r.platform_name}: ${id}`;
      })
      .join('\n');

    await updatePostlyMetadata(notion_page_id, {
      instagram_status: instagramStatus,
      instagram_url: firstUrl,
      post_id: postIdLog,
      final_status: finalStatus,
    });

    console.log(`[POSTLY-USE-CASE] Pipeline finished. instagram_status=${instagramStatus} final=${finalStatus}`);
    return { status: finalStatus, results: finalResults, attempts: currentAttempt };

  } catch (error: any) {
    console.error(`[POSTLY-USE-CASE] Critical failure:`, error);
    await updatePostlyMetadata(notion_page_id, {
      instagram_status: 'Failed',
      final_status: 'Postly Error',
    });
    throw error;
  }
}

function normalizePostlyResults(post: any, target_platform_ids: string[]) {
  const results: any[] = [];
  const platforms = post.target_platforms || [];

  for (const id of target_platform_ids) {
    const platformData = platforms.find((p: any) => p.id === id);
    if (!platformData) {
      results.push({ platform_id: id, platform_name: 'unknown', status: 'pending', error: 'Platform not found in post data' });
      continue;
    }
    const platformName = platformData.target || 'unknown';

    if (platformData.success_responses && platformData.success_responses.length > 0) {
      const resp = platformData.success_responses[0];
      results.push({
        platform_id: id,
        platform_name: platformName,
        status: 'published',
        external_id: resp.post_id || resp.media_id || resp.uri,
        url: resp.uri,
        published_at: resp.published_at,
      });
    } else if (platformData.error_responses && platformData.error_responses.length > 0) {
      results.push({
        platform_id: id,
        platform_name: platformName,
        status: 'failed',
        error: platformData.error_responses[0].message,
      });
    } else {
      results.push({ platform_id: id, platform_name: platformName, status: 'pending' });
    }
  }
  return results;
}

function findMatchingPost(posts: any[], text: string, media_url?: string) {
  return posts.find(post => {
    const textMatch = post.text && text && post.text.includes(text.substring(0, 50));
    const mediaMatch =
      media_url && post.media && post.media.some((m: any) => m.remote_url === media_url || m.url === media_url);
    return textMatch || mediaMatch;
  });
}
