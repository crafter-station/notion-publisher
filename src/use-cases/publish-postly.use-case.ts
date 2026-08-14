import { PostlyService, PostlyTargetPlatform } from '../services/postly.service';
import { updatePostlyMetadata, PostlyContent, FinalStatus, PostlyPublishStatus } from '../services/notion.service';
import { execFile } from 'child_process';
import { promisify } from 'util';

export interface PublishPostlyParams {
  workspace_id: string;
  target_platforms: PostlyTargetPlatform[];
  content: PostlyContent;
  notion_page_id: string;
}

const POLLING_SCHEDULE_SECONDS = [30, 10, 20, 30, 40, 50, 60];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const execFileAsync = promisify(execFile);

async function resolveVideoCoverKeyFrameSeconds(content: PostlyContent) {
  if (content.media_type !== 'video/mp4' || !content.media_url) return undefined;

  const parsedDuration = await resolveMp4DurationSeconds(content.media_url);
  if (parsedDuration) {
    const midpoint = Math.max(1, Math.floor(parsedDuration / 2));
    console.log(`[POSTLY-USE-CASE] Video duration ${parsedDuration.toFixed(2)}s from MP4 metadata; Pinterest cover keyframe ${midpoint}s`);
    return midpoint;
  }

  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      content.media_url,
    ], { timeout: 20000 });
    const duration = Number.parseFloat(stdout.trim());
    if (!Number.isFinite(duration) || duration <= 0) {
      console.warn(`[POSTLY-USE-CASE] Could not determine video duration from ffprobe output: ${stdout.trim()}`);
      return 1;
    }

    const midpoint = Math.max(1, Math.floor(duration / 2));
    console.log(`[POSTLY-USE-CASE] Video duration ${duration.toFixed(2)}s; Pinterest cover keyframe ${midpoint}s`);
    return midpoint;
  } catch (error: any) {
    console.warn(`[POSTLY-USE-CASE] ffprobe unavailable or failed; using Pinterest cover keyframe fallback 1s. ${error.message}`);
    return 1;
  }
}

async function resolveMp4DurationSeconds(url: string) {
  const chunks = await fetchMp4ProbeChunks(url);
  for (const chunk of chunks) {
    const duration = parseMp4DurationSeconds(chunk);
    if (duration) return duration;
  }
  return undefined;
}

async function fetchMp4ProbeChunks(url: string) {
  const chunkSize = 2 * 1024 * 1024;
  const chunks: Buffer[] = [];

  const firstChunk = await fetchRange(url, 0, chunkSize - 1).catch((error: any) => {
    console.warn(`[POSTLY-USE-CASE] Could not fetch MP4 first probe chunk: ${error.message}`);
    return undefined;
  });
  if (firstChunk) chunks.push(firstChunk);

  const contentLength = await fetchContentLength(url);
  if (contentLength && contentLength > chunkSize) {
    const lastChunk = await fetchRange(url, Math.max(0, contentLength - chunkSize), contentLength - 1).catch((error: any) => {
      console.warn(`[POSTLY-USE-CASE] Could not fetch MP4 last probe chunk: ${error.message}`);
      return undefined;
    });
    if (lastChunk) chunks.push(lastChunk);
  }

  return chunks;
}

async function fetchContentLength(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
    const value = response.headers.get('content-length');
    const parsed = value ? Number.parseInt(value, 10) : NaN;
    return Number.isFinite(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchRange(url: string, start: number, end: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      headers: { Range: `bytes=${start}-${end}` },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}

function parseMp4DurationSeconds(buffer: Buffer) {
  let searchFrom = 0;
  while (searchFrom < buffer.length) {
    const mvhdTypeOffset = buffer.indexOf('mvhd', searchFrom, 'ascii');
    if (mvhdTypeOffset === -1) return undefined;

    const versionOffset = mvhdTypeOffset + 4;
    if (versionOffset >= buffer.length) return undefined;

    const version = buffer.readUInt8(versionOffset);
    if (version === 0 && mvhdTypeOffset + 24 <= buffer.length) {
      const timescale = buffer.readUInt32BE(mvhdTypeOffset + 16);
      const duration = buffer.readUInt32BE(mvhdTypeOffset + 20);
      if (timescale > 0 && duration > 0) return duration / timescale;
    }
    if (version === 1 && mvhdTypeOffset + 36 <= buffer.length) {
      const timescale = buffer.readUInt32BE(mvhdTypeOffset + 24);
      const duration = Number(buffer.readBigUInt64BE(mvhdTypeOffset + 28));
      if (timescale > 0 && duration > 0) return duration / timescale;
    }

    searchFrom = mvhdTypeOffset + 4;
  }

  return undefined;
}

/**
 * Build platform_posts array for Postly. Postly expects each override to name
 * the target platform and carry caption text in `text_override`; putting text
 * inside `settings` makes the API parser fall back to PlatformIdentifier.none.
 */
async function buildPlatformPosts(content: PostlyContent, targetPlatforms: PostlyTargetPlatform[]) {
  const targetIdentifiers = new Set(targetPlatforms.map(p => p.identifier));
  const out: Array<{ identifier: string; text_override?: string; settings?: Record<string, any> }> = [];
  const pinterestCoverKeyFrame = await resolveVideoCoverKeyFrameSeconds(content);
  const firstCommentSettings = content.first_comment
    ? {
        auto_generate_first_comment: false,
        first_comment: content.first_comment,
      }
    : {};

  const push = (identifier: string, text_override?: string, settings: Record<string, any> = {}) => {
    if (!targetIdentifiers.has(identifier)) return;

    const cleanSettings: Record<string, any> = {};
    for (const [k, v] of Object.entries(settings)) {
      if (v !== undefined && v !== null && v !== '') cleanSettings[k] = v;
    }

    const cleanText = text_override?.trim();
    if (!cleanText && Object.keys(cleanSettings).length === 0) return;

    out.push({
      identifier,
      ...(cleanText ? { text_override: cleanText } : {}),
      settings: { identifier, ...cleanSettings },
    });
  };

  push('instagram', content.caption_instagram, {
    share_to_feed: true,
    share_as_story: false,
    share_as_reel: content.media_type === 'video/mp4',
    add_first_comment: !!content.first_comment,
    ...firstCommentSettings,
  });
  push('facebook', content.caption_facebook, {
    share_to_feed: true,
    share_as_carousel: false,
    share_as_story: false,
    share_as_reel: content.media_type === 'video/mp4',
    ...firstCommentSettings,
  });
  push('linkedin', content.caption_linkedin, {
    content_type: 'regular',
    feed_distribution: 'mainFeed',
    visibility: 'public',
    lifecycle_state: 'published',
    publish_with_author_account: false,
    enable_resharing: true,
    ...firstCommentSettings,
  });
  push('tiktok', content.caption_tiktok, {
    share_to_feed: true,
    share_as_story: false,
    privacy_level: 'PUBLIC_TO_EVERYONE',
    disable_duet: false,
    disable_stitch: false,
    disable_comment: false,
    brand_content_toggle: false,
    brand_organic_toggle: false,
    is_aigc: false,
  });
  push('threads', content.caption_threads, {
    reply_control: 'everyone',
    allow_quotes: true,
  });
  push('pinterest', content.pinterest_description, {
    title: content.pinterest_title,
    description: content.pinterest_description,
    create_idea_pin: false,
    allow_comments: true,
    allow_try_on: false,
    cover_image_key_frame_time: pinterestCoverKeyFrame,
  });
  push('youtube', content.youtube_caption, {
    title: content.youtube_title,
    privacy: 'Public',
    region_code: 'US',
    made_for_kids: false,
    embeddable: true,
    notify_subscribers: true,
    ...firstCommentSettings,
  });

  // Capability stubs: only emit when identifier is in resolved targets (env unchanged today).
  const socialFallback = content.global_text || content.caption_threads || content.caption_instagram;
  push('bluesky', socialFallback, {});
  push('telegram', socialFallback, {});
  push('x', socialFallback, {});

  return out;
}

export async function executePublishPostlyUseCase(params: PublishPostlyParams) {
  const postly = new PostlyService();
  const { notion_page_id, workspace_id, target_platforms, content } = params;

  try {
    console.log(`[POSTLY-USE-CASE] Starting pipeline for Notion page: ${notion_page_id}`);
    console.log(`[POSTLY-USE-CASE] Target platforms (${target_platforms.length}): ${target_platforms.map(p => `${p.identifier}:${p.id}`).join(', ')}`);
    console.log(`[POSTLY-USE-CASE] Media: ${content.media_type} ${content.media_url}`);

    // PHASE 1 — Mark in-progress on Notion
    await updatePostlyMetadata(notion_page_id, { postly_status: 'In progress' });

    // PHASE 2 — Build payload and send
    const platform_posts = await buildPlatformPosts(content, target_platforms);
    console.log(`[POSTLY-USE-CASE] Phase 2: posting (${platform_posts.length} per-platform overrides)`);
    logPublishDiagnostics(content, target_platforms, platform_posts);

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
    logStoredPostDiagnostics('created/list', createdPost, target_platforms);

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
      if (currentAttempt === 1) {
        logStoredPostDiagnostics('poll/first', postStatus, target_platforms);
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
        logStoredPostDiagnostics('fallback/list', match, target_platforms);
        finalResults = normalizePostlyResults(match, target_platforms);
        isResolved = finalResults.every(r => r.status !== 'pending');
      }
    }

    // PHASE 6 — Aggregate and update Notion
    const publishedResults = finalResults.filter(r => r.status === 'published');
    const failedResults = finalResults.filter(r => r.status === 'failed');

    let postlyStatus: PostlyPublishStatus = 'Published';
    let finalStatus: FinalStatus = 'Published (EN)';

    if (publishedResults.length === 0) {
      postlyStatus = 'Failed';
      finalStatus = 'Error';
    } else if (failedResults.length > 0 || publishedResults.length < target_platforms.length) {
      // Partial — at least one published, at least one failed/pending. No "Partial" enum, mark Failed.
      postlyStatus = 'Failed';
      finalStatus = 'Error';
    }

    // First IG URL goes to `Postly URL`; fallback to any first published URL
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
      postly_status: postlyStatus,
      postly_url: firstUrl,
      post_id: postIdLog,
      final_status: finalStatus,
    });

    console.log(`[POSTLY-USE-CASE] Pipeline finished. postly_status=${postlyStatus} final=${finalStatus}`);
    return { status: finalStatus, results: finalResults, attempts: currentAttempt };

  } catch (error: any) {
    console.error(`[POSTLY-USE-CASE] Critical failure:`, error);
    await updatePostlyMetadata(notion_page_id, {
      postly_status: 'Failed',
      final_status: 'Error',
    });
    throw error;
  }
}

function normalizePostlyResults(post: any, target_platforms: PostlyTargetPlatform[]) {
  const results: any[] = [];
  const platforms = post.target_platforms || [];

  for (const targetPlatform of target_platforms) {
    const platformData = platforms.find((p: any) => p.id === targetPlatform.id);
    if (!platformData) {
      results.push({
        platform_id: targetPlatform.id,
        platform_name: targetPlatform.identifier,
        status: 'failed',
        error: 'Platform not found in post data',
      });
      continue;
    }
    const platformName = platformData.target || targetPlatform.identifier;

    if (platformData.success_responses && platformData.success_responses.length > 0) {
      const resp = platformData.success_responses[0];
      results.push({
        platform_id: targetPlatform.id,
        platform_name: platformName,
        status: 'published',
        external_id: resp.post_id || resp.media_id || resp.uri,
        url: resp.uri,
        published_at: resp.published_at,
      });
    } else if (platformData.error_responses && platformData.error_responses.length > 0) {
      results.push({
        platform_id: targetPlatform.id,
        platform_name: platformName,
        status: 'failed',
        error: platformData.error_responses[0].message,
      });
    } else {
      results.push({ platform_id: targetPlatform.id, platform_name: platformName, status: 'pending' });
    }
  }
  return results;
}

function logPublishDiagnostics(
  content: PostlyContent,
  targetPlatforms: PostlyTargetPlatform[],
  platformPosts: Array<{ identifier: string; text_override?: string; settings?: Record<string, any> }>
) {
  const contentFields = {
    queue: {
      brand: content.brand || undefined,
      select: content.select || undefined,
      source_url_host: content.source_url ? safeHost(content.source_url) : undefined,
    },
    captions: {
      instagram: content.caption_instagram.length,
      facebook: content.caption_facebook.length,
      linkedin: content.caption_linkedin.length,
      tiktok: content.caption_tiktok.length,
      threads: content.caption_threads.length,
      pinterest_title: content.pinterest_title.length,
      pinterest_description: content.pinterest_description.length,
      youtube_title: content.youtube_title.length,
      youtube_caption: content.youtube_caption.length,
      first_comment: content.first_comment.length,
      global_text: content.global_text.length,
    },
    media: {
      type: content.media_type,
      has_url: !!content.media_url,
      url_host: content.media_url ? safeHost(content.media_url) : undefined,
    },
  };
  console.log(`[POSTLY-USE-CASE] Content fields: ${JSON.stringify(contentFields)}`);
  console.log(`[POSTLY-USE-CASE] Requested targets: ${targetPlatforms.map(p => `${p.identifier}:${p.id}`).join(', ')}`);
  console.log(`[POSTLY-USE-CASE] Platform override fields: ${platformPosts.map(p => {
    const settingKeys = Object.keys(p.settings || {}).sort().join('|');
    return `${p.identifier}{text=${!!p.text_override};settings=${settingKeys}}`;
  }).join(', ')}`);
}

function logStoredPostDiagnostics(stage: string, post: any, requestedTargets: PostlyTargetPlatform[]) {
  const returnedTargets = post.target_platforms || [];
  const returnedTargetIds = new Set(returnedTargets.map((p: any) => p.id));
  const missingTargets = requestedTargets.filter(target => !returnedTargetIds.has(target.id));
  const mediaFields = (post.media || []).map((media: any) => Object.keys(media || {}).sort());
  const platformPostFields = (post.platform_posts || []).map((platformPost: any) => ({
    identifier: platformPost.identifier,
    fields: Object.keys(platformPost || {}).sort(),
    settings: Object.keys(platformPost.settings || {}).sort(),
  }));

  console.log(`[POSTLY-USE-CASE] Stored post diagnostics (${stage}): requested=${requestedTargets.length} returned=${returnedTargets.length} platform_posts=${(post.platform_posts || []).length}`);
  console.log(`[POSTLY-USE-CASE] Stored targets (${stage}): ${returnedTargets.map((p: any) => `${p.target || '?'}:${p.id}:${p.name || ''}`).join(', ')}`);
  console.log(`[POSTLY-USE-CASE] Stored media fields (${stage}): ${JSON.stringify(mediaFields)}`);
  console.log(`[POSTLY-USE-CASE] Stored platform_post fields (${stage}): ${JSON.stringify(platformPostFields)}`);

  if (missingTargets.length > 0) {
    console.warn(`[POSTLY-USE-CASE] Missing returned targets (${stage}): ${missingTargets.map(p => `${p.identifier}:${p.id}`).join(', ')}`);
  }

  const pinterestPost = (post.platform_posts || []).find((p: any) => p.identifier === 'pinterest');
  if (pinterestPost && !Object.prototype.hasOwnProperty.call(pinterestPost.settings || {}, 'cover_image_key_frame_time')) {
    console.warn(`[POSTLY-USE-CASE] Pinterest settings stored without cover_image_key_frame_time (${stage}). Available settings: ${Object.keys(pinterestPost.settings || {}).sort().join(', ')}`);
  }
}

function safeHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return 'invalid-url';
  }
}

function findMatchingPost(posts: any[], text: string, media_url?: string) {
  return posts.find(post => {
    const textMatch = post.text && text && post.text.includes(text.substring(0, 50));
    const mediaMatch =
      media_url && post.media && post.media.some((m: any) => m.remote_url === media_url || m.url === media_url);
    return textMatch || mediaMatch;
  });
}
