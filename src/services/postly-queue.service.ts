import { env } from '../config/env';
import { executePublishPostlyUseCase } from '../use-cases/publish-postly.use-case';
import { extractPostlyContent, queryNextPostlyQueueCandidates, updatePostlyMetadata } from './notion.service';
import { PostlyService } from './postly.service';
import { resolveDefaultPostlyTargetPlatforms } from './postly-targets.service';

export async function processNextPostlyQueueItem() {
  const databaseId = env.POSTLY_QUEUE_DATABASE_ID;
  if (!databaseId) {
    throw new Error('POSTLY_QUEUE_DATABASE_ID or NOTION_DATABASE_ID must be configured for the Postly queue scheduler.');
  }

  if (env.POSTLY_QUEUE_BLOCK_ON_PENDING_POSTS) {
    const blockingPost = await findRecentAllPendingPost();
    if (blockingPost) {
      console.warn(`[POSTLY-QUEUE] Queue paused; recent Postly post is still fully pending: ${blockingPost.id} age=${Math.round(blockingPost.ageMs / 60000)}m targets=${blockingPost.targetCount}.`);
      return {
        status: 'blocked-by-pending-post',
        post_id: blockingPost.id,
        age_ms: blockingPost.ageMs,
        target_count: blockingPost.targetCount,
      };
    }
  }

  const candidates = await queryNextPostlyQueueCandidates(databaseId, 10);
  console.log(`[POSTLY-QUEUE] Found ${candidates.length} queue candidate(s).`);

  for (const page of candidates) {
    const content = extractPostlyContent(page.properties || {});
    const label = `${page.id} brand=${content.brand || 'missing'} select=${content.select || 'missing'} sourceUrl=${content.source_url ? 'yes' : 'no'}`;

    if (!content.is_complete) {
      console.warn(`[POSTLY-QUEUE] Skipping incomplete candidate ${label}. Missing: ${content.missing.join('; ')}`);
      continue;
    }

    const target_platforms = resolveDefaultPostlyTargetPlatforms();
    console.log(`[POSTLY-QUEUE] Publishing ${label} using POSTLY_TARGET_PLATFORMS (${target_platforms.length} target(s)).`);

    await updatePostlyMetadata(page.id, {
      instagram_status: 'In progress',
      final_status: 'In progress',
      post_id: `Auto queue started at ${new Date().toISOString()}`,
    });

    await executePublishPostlyUseCase({
      workspace_id: env.POSTLY_WORKSPACE_ID,
      target_platforms,
      content,
      notion_page_id: page.id,
    });

    return {
      status: 'published-attempted',
      page_id: page.id,
      brand: content.brand,
      select: content.select,
      target_source: 'POSTLY_TARGET_PLATFORMS',
      target_count: target_platforms.length,
    };
  }

  return {
    status: 'idle',
    checked_candidates: candidates.length,
  };
}

async function findRecentAllPendingPost() {
  const postly = new PostlyService();
  const posts = await postly.listPosts(env.POSTLY_WORKSPACE_ID);
  const now = Date.now();

  for (const post of posts.slice(0, 10)) {
    const createdAt = Date.parse(post.createdAt || post.created_at || '');
    if (!Number.isFinite(createdAt)) continue;

    const ageMs = now - createdAt;
    if (ageMs < 0 || ageMs > env.POSTLY_QUEUE_PENDING_BLOCK_WINDOW_MS) continue;

    const targets = post.target_platforms || [];
    if (targets.length === 0) continue;

    const allPending = targets.every((target: any) =>
      (target.success_responses || []).length === 0 &&
      (target.error_responses || []).length === 0
    );

    if (allPending) {
      return {
        id: post._id,
        ageMs,
        targetCount: targets.length,
      };
    }
  }

  return undefined;
}
