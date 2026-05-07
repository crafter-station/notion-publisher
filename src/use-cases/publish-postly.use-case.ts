import { PostlyService } from '../services/postly.service';
import { updatePostlyMetadata } from '../services/notion.service';

export interface PublishPostlyParams {
  workspace_id: string;
  target_platforms: string[];
  caption: string;
  media_url: string;
  notion_page_id: string;
}

const POLLING_SCHEDULE_SECONDS = [30, 10, 20, 30, 40, 50, 60];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function executePublishPostlyUseCase(params: PublishPostlyParams) {
  const postly = new PostlyService();
  const { notion_page_id, workspace_id, target_platforms, caption, media_url } = params;

  try {
    console.log(`[POSTLY-USE-CASE] Starting pipeline for Notion page: ${notion_page_id}`);

    // PHASE 1 — CREATE RECORD IN NOTION
    console.log(`[POSTLY-USE-CASE] Phase 1: Initializing Notion properties...`);
    await updatePostlyMetadata(notion_page_id, {
      instagram_status: 'In progress'
    });

    // PHASE 2 — SEND POST REQUEST
    console.log(`[POSTLY-USE-CASE] Phase 2: Creating post in Postly...`);
    
    // Dynamically determine media type to prevent Postly 400 errors
    const isVideo = media_url.toLowerCase().includes('.mp4');
    const mediaType = isVideo ? 'video/mp4' : 'image/jpeg';
    
    await postly.createPost({
      workspace: workspace_id,
      target_platforms: target_platforms,
      text: caption,
      media: [{ url: media_url, type: mediaType }]
    });

    console.log(`[POSTLY-USE-CASE] Post accepted. Waiting 3s to fetch its internal ID...`);
    await delay(3000);
    
    const recentPosts = await postly.listPosts(workspace_id);
    const createdPost = findMatchingPost(recentPosts, caption, media_url);

    if (!createdPost || !createdPost._id) {
      throw new Error("Could not find the newly created post's ID in Postly via list matching.");
    }

    const internal_post_id = createdPost._id;
    console.log(`[POSTLY-USE-CASE] Post found. Internal ID: ${internal_post_id}`);

    // PHASE 3 — DELAYED VERIFICATION LOOP
    let finalResults: any[] = [];
    let currentAttempt = 0;
    let isResolved = false;

    for (const waitTime of POLLING_SCHEDULE_SECONDS) {
      currentAttempt++;
      console.log(`[POSTLY-USE-CASE] Phase 3: Wait ${waitTime}s before attempt ${currentAttempt}...`);
      await delay(waitTime * 1000);

      console.log(`[POSTLY-USE-CASE] Attempt ${currentAttempt}: Fetching post status...`);
      const postStatus = await postly.getPost(workspace_id, internal_post_id);

      if (!postStatus) {
        console.warn(`[POSTLY-USE-CASE] Post ${internal_post_id} not found in listing. Retrying...`);
        continue;
      }

      // PHASE 4 — NORMALIZE RESULTS
      const normalized = normalizePostlyResults(postStatus, target_platforms);
      finalResults = normalized;

      // Check if all platforms are resolved
      const unresolved = normalized.filter(r => r.status === 'pending');
      if (unresolved.length === 0) {
        console.log(`[POSTLY-USE-CASE] All platforms resolved.`);
        isResolved = true;
        break;
      }

      console.log(`[POSTLY-USE-CASE] ${unresolved.length} platforms still pending. Continuing loop...`);
    }

    // PHASE 5 — MATCHING FALLBACK
    if (!isResolved) {
      console.log(`[POSTLY-USE-CASE] Phase 5: Polling finished without full resolution. Attempting fallback match...`);
      const allPosts = await postly.listPosts(workspace_id);
      const match = findMatchingPost(allPosts, caption, media_url);
      
      if (match) {
        console.log(`[POSTLY-USE-CASE] Fallback match found! Overriding results.`);
        finalResults = normalizePostlyResults(match, target_platforms);
        isResolved = finalResults.every(r => r.status !== 'pending');
      }
    }

    // PHASE 6 — UPDATE NOTION
    console.log(`[POSTLY-USE-CASE] Phase 6: Final Notion update...`);
    
    const publishedResults = finalResults.filter(r => r.status === 'published');
    const failedResults = finalResults.filter(r => r.status === 'failed');

    let overallStatus: 'Failed' | 'Published' | 'In progress' = 'In progress';

    // If all requested platforms are published successfully
    if (publishedResults.length === target_platforms.length) {
      overallStatus = 'Published';
    } 
    // If any platform failed, mark the whole task as failed so it can be reviewed
    else if (failedResults.length > 0) {
      overallStatus = 'Failed';
    } 
    // If polling timed out without resolution
    else if (currentAttempt >= POLLING_SCHEDULE_SECONDS.length && !isResolved) {
      overallStatus = 'Failed';
    }

    // Join all URLs and Post IDs separated by commas
    const combinedUrls = publishedResults.length > 0 
      ? publishedResults.map(r => r.url).filter(Boolean).join(', ') 
      : undefined;
      
    const combinedPostIds = publishedResults.length > 0 
      ? publishedResults.map(r => r.external_id).filter(Boolean).join(', ') 
      : undefined;

    await updatePostlyMetadata(notion_page_id, {
      instagram_status: overallStatus,
      instagram_url: combinedUrls,
      post_id: combinedPostIds
    });

    console.log(`[POSTLY-USE-CASE] Pipeline finished with IG status: ${overallStatus}`);

    return {
      status: overallStatus,
      results: finalResults,
      attempts: currentAttempt
    };

  } catch (error: any) {
    console.error(`[POSTLY-USE-CASE] Critical failure:`, error);
    await updatePostlyMetadata(notion_page_id, { instagram_status: 'Failed' });
    throw error;
  }
}

function normalizePostlyResults(post: any, target_platform_ids: string[]) {
  const results: any[] = [];
  const platforms = post.target_platforms || [];

  for (const id of target_platform_ids) {
    const platformData = platforms.find((p: any) => p.id === id);
    
    if (!platformData) {
      results.push({ platform_id: id, status: 'pending', error: 'Platform not found in post data' });
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
        published_at: resp.published_at
      });
    } else if (platformData.error_responses && platformData.error_responses.length > 0) {
      results.push({
        platform_id: id,
        platform_name: platformName,
        status: 'failed',
        error: platformData.error_responses[0].message
      });
    } else {
      results.push({
        platform_id: id,
        platform_name: platformName,
        status: 'pending'
      });
    }
  }

  return results;
}

function findMatchingPost(posts: any[], caption: string, media_url: string) {
  // Simple matching logic
  return posts.find(post => {
    const textMatch = post.text && post.text.includes(caption.substring(0, 50)); // Partial match
    const mediaMatch = post.media && post.media.some((m: any) => m.remote_url === media_url || m.url === media_url);
    return textMatch || mediaMatch;
  });
}
