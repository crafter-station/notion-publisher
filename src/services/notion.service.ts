import { env } from '../config/env';
import { PUBLISHER_PROPERTY_NAMES as PN } from '../config/schema';
import { createPropertyReader } from '../readers/props';
import { markdownToGumroadHtml } from './markdown.service';

const notionToken = env.NOTION_TOKEN;
// ponytail: stay on 2022-06-28 — DB query/properties work; 2025-09-03 data_sources needs separate query path
export const NOTION_VERSION = '2022-06-28';

export async function getNotionPage(pageId: string) {
  if (!notionToken) throw new Error('Missing NOTION_TOKEN');

  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': NOTION_VERSION
    }
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to fetch Notion page: ${err}`);
  }

  return response.json();
}

export function parseNotionPage(pageData: any) {
  const props = pageData.properties || {};
  let is_incomplete = false;

  // Reassemble JSON from fragmented rich_text
  let chain_json = {};
  if (props['Template'] && props['Template'].rich_text && props['Template'].rich_text.length > 0) {
    try {
      const templateStr = props['Template'].rich_text.map((t: any) => t.plain_text).join('');
      if (templateStr) {
        chain_json = JSON.parse(templateStr);
      } else {
        is_incomplete = true;
      }
    } catch (e) {
      console.warn('Failed to parse Template JSON from Notion:', e);
      is_incomplete = true;
    }
  } else {
    is_incomplete = true;
  }

  if (Object.keys(chain_json).length === 0) {
    is_incomplete = true;
  }

  // Extract Title — Publisher uses Name; archive used Prompt Chain Template Name
  let title = 'Untitled Chain';
  if (props['Gumroad Title'] && props['Gumroad Title'].rich_text && props['Gumroad Title'].rich_text.length > 0) {
    title = props['Gumroad Title'].rich_text.map((t: any) => t.plain_text).join('');
  } else if (props['Name']?.title?.length) {
    title = props['Name'].title.map((t: any) => t.plain_text).join('');
  } else if (props['Prompt Chain Template Name']?.title?.length) {
    title = props['Prompt Chain Template Name'].title.map((t: any) => t.plain_text).join('');
  } else {
    is_incomplete = true;
  }

  // Extract Description (Landing Page Copy)
  let description = 'Auto-published dataset';
  let landing_page_copy_markdown = '';
  if (props['Landing Page Copy'] && props['Landing Page Copy'].rich_text && props['Landing Page Copy'].rich_text.length > 0) {
    landing_page_copy_markdown = props['Landing Page Copy'].rich_text.map((t: any) => t.plain_text).join('');
    description = markdownToGumroadHtml(landing_page_copy_markdown);
  } else {
    is_incomplete = true;
  }

  // Extract Images
  const getFileUrl = (propArray: any[]) => {
    if (!propArray || propArray.length === 0) return undefined;
    const fileObj = propArray[0];
    if (fileObj.type === 'external') return fileObj.external?.url;
    if (fileObj.type === 'file') return fileObj.file?.url;
    return undefined;
  };

  // Cover/Icon lived on archive Templates DB; Publisher keeps Gumroad Cover/Thumbnail (+ optional Cover/Icon if re-added)
  const cover_url = getFileUrl(props['Gumroad Cover']?.files);
  const thumbnail_url = getFileUrl(props['Gumroad Thumbnail']?.files);
  const general_cover_url = getFileUrl(props['Cover']?.files) || cover_url;
  const icon_url = getFileUrl(props['Icon']?.files) || thumbnail_url;

  const gumroad_product_id = props['Gumroad Product ID']?.rich_text?.[0]?.plain_text || undefined;
  const public_url = props['Gumroad URL']?.url || undefined;

  return {
    id: pageData.id,
    title,
    description,
    landing_page_copy_markdown,
    chain_json,
    general_cover_url,
    icon_url,
    cover_url,
    thumbnail_url,
    gumroad_product_id,
    public_url,
    slug: public_url ? public_url.split('/').pop() : undefined,
    is_incomplete
  };
}

export async function updateNotionMetadata(
  notion_page_id: string,
  gumroad_product_id: string,
  gumroad_short_url: string,
  gumroad_slug: string,
  publication_status: 'draft' | 'publishing' | 'published' | 'error' | 'unpublished'
) {
  if (!notionToken || !notion_page_id) {
    return { success: false, error: 'Missing notion token or page id' };
  }

  // Map internal status to Notion options
  // Options: 'Not started', 'Unpublished', 'Failed', 'Published'
  let notionStatus = 'Not started';
  if (publication_status === 'published') notionStatus = 'Published';
  else if (publication_status === 'error') notionStatus = 'Failed';
  else if (publication_status === 'publishing') notionStatus = 'Unpublished';
  else if (publication_status === 'unpublished') notionStatus = 'Unpublished';
  else if (publication_status === 'draft') notionStatus = 'Not started';

  const properties: any = {
    'Gumroad Publish Status': {
      status: { name: notionStatus }
    }
  };

  if (gumroad_product_id) {
    properties['Gumroad Product ID'] = {
      rich_text: [{ text: { content: gumroad_product_id } }]
    };
  }

  if (gumroad_short_url) {
    properties['Gumroad URL'] = { url: gumroad_short_url };
  }

  const gumroad_edit_url = gumroad_slug ? `https://app.gumroad.com/products/${gumroad_slug}/edit` : '';
  if (gumroad_edit_url) {
    properties['Gumroad Edit URL'] = { url: gumroad_edit_url };
  }

  try {
    const response = await fetch(`https://api.notion.com/v1/pages/${notion_page_id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION
      },
      body: JSON.stringify({ properties })
    });

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: err };
    }

    return {
      success: true,
      updated_page_id: notion_page_id,
      gumroad_url: gumroad_short_url,
      gumroad_edit_url: gumroad_edit_url
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Unknown error' };
  }
}

export type PostlyPublishStatus = 'Not started' | 'In progress' | 'Failed' | 'Published';
export type FinalStatus =
  | 'Not started' | 'In progress' | 'Published'
  | 'Published (EN)' | 'Published (ES)' | 'Published (PT)'
  | 'Error' | 'Render Error' | 'Done';
/** @deprecated use PostlyPublishStatus */
export type InstagramStatus = PostlyPublishStatus;

export interface PostlyContent {
  brand: string;
  select: string;
  source_url: string;
  caption_instagram: string;
  caption_facebook: string;
  caption_linkedin: string;
  caption_tiktok: string;
  caption_threads: string; // sourced from "Twitter Post"
  pinterest_title: string;
  pinterest_description: string;
  youtube_title: string;
  youtube_caption: string;
  first_comment: string;
  global_text: string;
  media_url?: string;
  media_type: 'video/mp4' | 'image/gif' | 'image/jpeg' | 'image/png';
  is_complete: boolean;
  missing: string[];
}

const _richText = (p: any): string =>
  (p?.rich_text?.length ? p.rich_text.map((t: any) => t.plain_text).join('') : '').trim();
const _selectName = (p: any): string => (p?.select?.name || '').trim();
const _fileUrl = (p: any): string | undefined => {
  const files = p?.files;
  if (!files || files.length === 0) return undefined;
  const f = files[0];
  if (f.type === 'external') return f.external?.url;
  if (f.type === 'file') return f.file?.url;
  return undefined;
};

/**
 * Reads ALL Postly-relevant fields from an AI POVs DB Notion page.
 * Returns per-platform captions plus a global fallback text and a single common media.
 * EN-only (v1). Multilingual support (ES/PT prefixed fields) deferred.
 */
export function extractPostlyContent(props: any): PostlyContent {
  const r = createPropertyReader(props || {});
  const missing: string[] = [];

  const caption_instagram = r.richText(PN.instagramCaption);
  const caption_facebook = r.richText(PN.facebookPost);
  const caption_linkedin = r.richText(PN.linkedinPost);
  const caption_tiktok = r.richText(PN.tiktokCaption);
  const caption_threads = r.richText(PN.twitterPost);
  const pinterest_title = r.richText(PN.pinterestTitle);
  const pinterest_description = r.richText(PN.pinterestDescription);
  const youtube_title = r.richText(PN.youtubeTitle);
  const youtube_caption = r.richText(PN.youtubeCaption);
  const first_comment = r.richText(PN.universalFirstComment);
  // ponytail: Caption preferred when set; POV Text kept as legacy alias
  const caption = r.richText(PN.caption);
  const pov_text = r.richText(PN.povText);
  const brand = r.select(PN.brand);
  const select = r.select(PN.select);
  const source_url = r.url(PN.url);

  // Global fallback: Caption → POV Text → else first non-empty platform caption
  const global_text =
    caption ||
    pov_text ||
    caption_instagram ||
    caption_facebook ||
    caption_linkedin ||
    pinterest_description ||
    youtube_caption ||
    caption_threads ||
    caption_tiktok ||
    '';

  if (!global_text) missing.push('All caption fields empty (Caption/POV Text + per-platform)');

  // Media priority: Video → GIF → Image → Screenshot
  const videoUrl = r.fileUrl(PN.video) || undefined;
  const gifUrl = r.fileUrl(PN.gif) || undefined;
  const imageUrl = r.fileUrl(PN.image) || undefined;
  const screenshotUrl = r.fileUrl(PN.screenshot) || undefined;

  let media_url: string | undefined;
  let media_type: PostlyContent['media_type'] = 'image/jpeg';

  if (videoUrl) {
    media_url = videoUrl;
    media_type = 'video/mp4';
  } else if (gifUrl) {
    media_url = gifUrl;
    media_type = 'image/gif';
  } else if (imageUrl) {
    media_url = imageUrl;
    media_type = /\.png(\?|$)/i.test(imageUrl) ? 'image/png' : 'image/jpeg';
  } else if (screenshotUrl) {
    media_url = screenshotUrl;
    media_type = /\.png(\?|$)/i.test(screenshotUrl) ? 'image/png' : 'image/jpeg';
  } else {
    missing.push('Video / GIF / Image / Screenshot (no media file attached)');
  }

  return {
    brand,
    select,
    source_url,
    caption_instagram,
    caption_facebook,
    caption_linkedin,
    caption_tiktok,
    caption_threads,
    pinterest_title,
    pinterest_description,
    youtube_title,
    youtube_caption,
    first_comment,
    global_text,
    media_url,
    media_type,
    is_complete: missing.length === 0,
    missing,
  };
}

export async function queryNextPostlyQueueCandidates(databaseId: string, pageSize = 10) {
  if (!notionToken || !databaseId) {
    throw new Error('Missing notion token or Postly queue database id');
  }

  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    },
    body: JSON.stringify({
      page_size: pageSize,
      filter: {
        and: [
          // Unified Publisher: only social rows
          {
            or: [
              { property: 'Source Tags', multi_select: { contains: 'Postly' } },
              { property: 'Layer', select: { equals: 'Social' } },
            ],
          },
          { property: 'url', url: { is_not_empty: true } },
          { property: 'Select', select: { is_not_empty: true } },
          { property: 'Brand', select: { is_not_empty: true } },
          { property: 'Status', status: { equals: 'Not started' } },
          { property: 'Postly Publish Status', status: { equals: 'Not started' } },
        ],
      },
      sorts: [
        { property: 'Date', direction: 'ascending' },
        { property: 'Created', direction: 'ascending' },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to query Postly queue candidates: ${err}`);
  }

  const result = await response.json();
  return result.results || [];
}

export async function queryNextGumroadAutopilotCandidates(databaseId: string, pageSize = 10) {
  if (!notionToken || !databaseId) {
    throw new Error('Missing notion token or Gumroad autopilot database id');
  }

  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    },
    body: JSON.stringify({
      page_size: pageSize,
      filter: {
        and: [
          // Unified Publisher: only product rows
          {
            or: [
              { property: 'Source Tags', multi_select: { contains: 'Gumroad' } },
              { property: 'Layer', select: { equals: 'Products' } },
            ],
          },
          { property: 'Gumroad URL', url: { is_empty: true } },
          { property: 'Gumroad Product ID', rich_text: { is_empty: true } },
          { property: 'Gumroad Publish Status', status: { equals: 'Not started' } },
          { property: 'Template', rich_text: { is_not_empty: true } },
          { property: 'Landing Page Copy', rich_text: { is_not_empty: true } },
          { property: 'Gumroad Cover', files: { is_not_empty: true } },
          { property: 'Gumroad Thumbnail', files: { is_not_empty: true } },
          {
            or: [
              { property: 'Gumroad Title', rich_text: { is_not_empty: true } },
              { property: 'Name', title: { is_not_empty: true } },
            ],
          },
        ],
      },
      sorts: [
        { property: 'Created', direction: 'ascending' },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to query Gumroad autopilot candidates: ${err}`);
  }

  const result = await response.json();
  return result.results || [];
}

/**
 * Writes Postly publishing status back to Publisher Notion page.
 * - `Postly Publish Status` (status): pipeline phase (Not started / In progress / Published / Failed)
 * - `Postly URL` (url): first published URL (IG preferred, else any platform)
 * - `Post ID` (rich_text): multi-line `<platform>: <id>`
 * - `Status` (status): aggregate — Published (EN) on full success, Error otherwise
 *
 * Each field is sent independently; a single property error doesn't abort the whole patch
 * (we log warnings but never throw).
 */
export async function updatePostlyMetadata(
  notion_page_id: string,
  data: {
    postly_status?: PostlyPublishStatus;
    postly_url?: string;
    post_id?: string;
    final_status?: FinalStatus;
    /** @deprecated use postly_status */
    instagram_status?: PostlyPublishStatus;
    /** @deprecated use postly_url */
    instagram_url?: string;
  }
) {
  if (!notionToken || !notion_page_id) {
    return { success: false, error: 'Missing notion token or page id' };
  }

  const properties: any = {};

  const postlyStatus = data.postly_status ?? data.instagram_status;
  const postlyUrl = data.postly_url ?? data.instagram_url;

  if (postlyStatus) {
    properties['Postly Publish Status'] = { status: { name: postlyStatus } };
  }
  if (postlyUrl) {
    properties['Postly URL'] = { url: postlyUrl };
  }
  if (data.post_id !== undefined) {
    properties['Post ID'] = {
      rich_text: [{ text: { content: data.post_id.slice(0, 2000) } }],
    };
  }
  if (data.final_status) {
    properties['Status'] = { status: { name: data.final_status } };
  }

  if (Object.keys(properties).length === 0) {
    return { success: true, updated_page_id: notion_page_id, noop: true };
  }

  try {
    const response = await fetch(`https://api.notion.com/v1/pages/${notion_page_id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
      },
      body: JSON.stringify({ properties }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.warn(`[NOTION] updatePostlyMetadata patch failed: ${err}`);
      return { success: false, error: err };
    }
    return { success: true, updated_page_id: notion_page_id };
  } catch (error: any) {
    console.warn(`[NOTION] updatePostlyMetadata exception: ${error.message}`);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

export type LumaPublishStatus = 'Not started' | 'In progress' | 'Failed' | 'Published';

export interface LumaContent {
  name: string;
  start_at: string;
  end_at: string;
  timezone: string;
  location: string;
  description_md: string;
  /** Notion Luma Cover file URL (Notion/S3); upload to Luma CDN before create */
  cover_url?: string;
  is_complete: boolean;
  missing: string[];
}

const _titleText = (p: any): string =>
  (p?.title?.length ? p.title.map((t: any) => t.plain_text).join('') : '').trim();

const _dateStart = (p: any): string => (p?.date?.start || '').trim();
const _dateEnd = (p: any): string => (p?.date?.end || '').trim();

/**
 * Publisher Luma props → create payload.
 * Cover: local Notion file URL; use-case uploads to Luma CDN.
 */
export function extractLumaContent(props: any): LumaContent {
  const r = createPropertyReader(props || {});
  const missing: string[] = [];
  const name =
    r.richText(PN.lumaTitle) ||
    r.richText(PN.lumaName) ||
    r.title(PN.name) ||
    '';
  const start_at = r.dateStart(PN.lumaStart);
  const end_at = r.dateEnd(PN.lumaEnd) || r.dateStart(PN.lumaEnd) || '';
  const location = r.richText(PN.lumaLocation);
  const description_md = r.richText(PN.lumaDescription);
  const cover_url = r.fileUrl(PN.lumaCover) || undefined;
  const timezone = env.GUMROAD_AUTOPILOT_TIMEZONE || 'America/Lima';

  if (!name) missing.push('Luma Title (or Name)');
  if (!start_at) missing.push('Luma Start');

  return {
    name,
    start_at,
    end_at,
    timezone,
    location,
    description_md,
    cover_url,
    is_complete: missing.length === 0,
    missing,
  };
}

export async function updateLumaMetadata(
  notion_page_id: string,
  data: {
    luma_status?: LumaPublishStatus;
    luma_url?: string;
    final_status?: FinalStatus;
  }
) {
  if (!notionToken || !notion_page_id) {
    return { success: false, error: 'Missing notion token or page id' };
  }

  const properties: any = {};
  if (data.luma_status) {
    properties['Luma Publish Status'] = { status: { name: data.luma_status } };
  }
  if (data.luma_url) {
    properties['Luma Event URL'] = { url: data.luma_url };
  }
  if (data.final_status) {
    properties['Status'] = { status: { name: data.final_status } };
  }

  if (Object.keys(properties).length === 0) {
    return { success: true, updated_page_id: notion_page_id, noop: true };
  }

  try {
    const response = await fetch(`https://api.notion.com/v1/pages/${notion_page_id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
      },
      body: JSON.stringify({ properties }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.warn(`[NOTION] updateLumaMetadata patch failed: ${err}`);
      return { success: false, error: err };
    }
    return { success: true, updated_page_id: notion_page_id };
  } catch (error: any) {
    console.warn(`[NOTION] updateLumaMetadata exception: ${error.message}`);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

export async function findPublisherPageByLumaUrl(lumaUrl: string): Promise<string | null> {
  const databaseId = env.NOTION_DATABASE_ID;
  if (!notionToken || !databaseId || !lumaUrl) return null;

  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${notionToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    },
    body: JSON.stringify({
      page_size: 1,
      filter: { property: 'Luma Event URL', url: { equals: lumaUrl } },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.warn(`[NOTION] findPublisherPageByLumaUrl failed: ${err}`);
    return null;
  }
  const result = await response.json();
  return result.results?.[0]?.id || null;
}

export async function createPublisherLumaPage(input: {
  name: string;
  start_at?: string;
  end_at?: string;
  location?: string;
  description_md?: string;
  cover_url?: string;
  luma_url: string;
  luma_status?: LumaPublishStatus;
  final_status?: FinalStatus;
}) {
  const databaseId = env.NOTION_DATABASE_ID;
  if (!notionToken || !databaseId) {
    return { success: false, error: 'Missing NOTION_TOKEN or NOTION_DATABASE_ID' };
  }

  const properties: any = {
    Name: { title: [{ text: { content: input.name.slice(0, 2000) } }] },
    'Luma Title': {
      rich_text: [{ text: { content: input.name.slice(0, 2000) } }],
    },
    'Luma Event URL': { url: input.luma_url },
    'Luma Publish Status': {
      status: { name: input.luma_status || 'Published' },
    },
    'Source Tags': { multi_select: [{ name: 'Luma' }] },
    Layer: { select: { name: 'Events' } },
  };

  if (input.final_status) {
    properties['Status'] = { status: { name: input.final_status } };
  }
  if (input.start_at) {
    properties['Luma Start'] = {
      date: {
        start: input.start_at,
        ...(input.end_at ? { end: input.end_at } : {}),
      },
    };
  }
  if (input.end_at) {
    properties['Luma End'] = { date: { start: input.end_at } };
  }
  if (input.location) {
    properties['Luma Location'] = {
      rich_text: [{ text: { content: input.location.slice(0, 2000) } }],
    };
  }
  if (input.description_md) {
    properties['Luma Description'] = {
      rich_text: [{ text: { content: input.description_md.slice(0, 2000) } }],
    };
  }
  if (input.cover_url) {
    properties['Luma Cover'] = {
      files: [
        {
          name: 'cover',
          type: 'external',
          external: { url: input.cover_url },
        },
      ],
    };
  }

  try {
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.warn(`[NOTION] createPublisherLumaPage failed: ${err}`);
      return { success: false, error: err };
    }
    const page = await response.json();
    return { success: true, page_id: page.id as string };
  } catch (error: any) {
    return { success: false, error: error.message || 'Unknown error' };
  }
}

export type GithubPublishStatus = 'Not started' | 'Mapped' | 'In progress' | 'Failed' | 'Published';

export interface GithubPublishContent {
  owner: string;
  repo: string;
  full_name: string;
  tag: string;
  /** Raw Notion Release Notes (may be empty / smoke stub). */
  release_notes: string;
  /** Landing Page Copy markdown from Gumroad row. */
  landing_page_md: string;
  asset_url?: string;
  template_json: string;
  gumroad_url: string;
  cover_url?: string;
  thumbnail_url?: string;
  title: string;
  is_complete: boolean;
  missing: string[];
}

/** True when Release Notes look like prior smoke / placeholder, not product copy. */
export function isGithubSmokeStubNotes(notes: string): boolean {
  const s = (notes || '').trim().toLowerCase();
  if (!s) return true;
  return (
    s.startsWith('draft smoke') ||
    s.includes('via notion-publisher (phase c)') ||
    s === 'published via notion-publisher.'
  );
}

/** Prefer real Release Notes; else Landing Page + Gumroad link. */
export function buildGithubReleaseBody(content: {
  release_notes: string;
  landing_page_md: string;
  gumroad_url: string;
}): string {
  const notes = (content.release_notes || '').trim();
  if (notes && !isGithubSmokeStubNotes(notes)) return notes;

  const landing = (content.landing_page_md || '').trim();
  const parts: string[] = [];
  if (landing) parts.push(landing);
  if (content.gumroad_url) {
    parts.push(`## Product\n\n[Buy on Gumroad](${content.gumroad_url})`);
  }
  if (parts.length === 0) {
    return content.gumroad_url
      ? `Gumroad: ${content.gumroad_url}\n\nPublished via notion-publisher.`
      : 'Published via notion-publisher.';
  }
  return parts.join('\n\n');
}

/** Minimal gpt-chain/gumroad-product README (English). */
export function buildGithubProductReadme(content: {
  title: string;
  landing_page_md: string;
  gumroad_url: string;
  cover_path?: string;
}): string {
  const landing = (content.landing_page_md || '').trim();
  // Drop leading H1 — we already emit product title.
  const body = landing.replace(/^#\s+[^\n]+\n+/, '').trim();
  const oneLiner =
    body
      .split('\n')
      .map(l => l.trim())
      .find(l => l && !l.startsWith('#')) || content.title;

  const lines: string[] = [`# ${content.title}`, '', oneLiner, ''];

  if (content.cover_path) {
    lines.push(`![Cover](${content.cover_path})`, '');
  }

  // Rest of landing after the one-liner paragraph (avoid duplicate).
  if (body) {
    const rest = body.startsWith(oneLiner)
      ? body.slice(oneLiner.length).replace(/^\n+/, '').trim()
      : body;
    if (rest) lines.push(rest, '');
  }

  if (content.gumroad_url) {
    lines.push('## Product', '', `[Buy on Gumroad](${content.gumroad_url})`, '');
  }

  lines.push(
    '## Files',
    '',
    '- `template.json` — GPT Chain prompt workflow (same payload as Gumroad)',
    '- GitHub Release asset — downloadable copy of the template',
    '',
    '## Scope',
    '',
    'Digital product mirror for GPT Chain. Not a runnable app — open `template.json` in your GPT Chain / prompt workflow tooling.',
    ''
  );

  return lines.join('\n');
}

/** Parse owner/repo from Notion GitHub Repo rich_text (accepts URL or owner/repo). */
export function parseGithubRepoField(raw: string): { owner: string; repo: string } | null {
  const s = (raw || '').trim();
  if (!s) return null;
  const urlMatch = s.match(/github\.com[/:]([^/\s]+)\/([^/\s#?]+)/i);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2].replace(/\.git$/, '') };
  }
  const parts = s.split('/').filter(Boolean);
  if (parts.length === 2) return { owner: parts[0], repo: parts[1] };
  return null;
}

export function extractGithubPublishContent(props: any): GithubPublishContent {
  const r = createPropertyReader(props || {});
  const missing: string[] = [];
  const repoRaw = r.richText(PN.githubRepo);
  const parsed = parseGithubRepoField(repoRaw);
  const owner = parsed?.owner || '';
  const repo = parsed?.repo || '';
  const full_name = owner && repo ? `${owner}/${repo}` : '';
  let tag = r.richText(PN.releaseTag);
  const release_notes = r.richText(PN.releaseNotes);
  const landing_page_md = r.richText(PN.landingPageCopy);
  const asset_url = r.fileUrl(PN.githubAsset) || r.fileUrl(PN.file) || undefined;
  const template_json = r.richText(PN.template);
  const gumroad_url = r.url(PN.gumroadUrl);
  const cover_url = r.fileUrl(PN.gumroadCover) || undefined;
  const thumbnail_url = r.fileUrl(PN.gumroadThumbnail) || undefined;
  const title =
    r.richText(PN.gumroadTitle) ||
    r.title(PN.name) ||
    repo ||
    'release';

  if (!owner || !repo) missing.push('GitHub Repo (owner/repo)');
  if (!tag) {
    const slug = (repo || title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
    tag = `v${day}-${slug || 'product'}`;
  }
  if (!template_json && !asset_url) missing.push('Template or GitHub Asset / File');

  return {
    owner,
    repo,
    full_name,
    tag,
    release_notes,
    landing_page_md,
    asset_url,
    template_json,
    gumroad_url,
    cover_url,
    thumbnail_url,
    title,
    is_complete: missing.length === 0,
    missing,
  };
}

export async function updateGithubMetadata(
  notion_page_id: string,
  data: {
    github_status?: GithubPublishStatus;
    release_url?: string;
    release_id?: string;
    github_repo?: string;
    final_status?: FinalStatus;
  }
) {
  if (!notionToken || !notion_page_id) {
    return { success: false, error: 'Missing notion token or page id' };
  }

  const properties: any = {};
  if (data.github_status) {
    properties['GitHub Publish Status'] = { status: { name: data.github_status } };
  }
  if (data.release_url) {
    properties['GitHub Release URL'] = { url: data.release_url };
  }
  if (data.release_id !== undefined) {
    properties['GitHub Release ID'] = {
      rich_text: [{ text: { content: String(data.release_id).slice(0, 2000) } }],
    };
  }
  if (data.github_repo) {
    properties['GitHub Repo'] = {
      rich_text: [{ text: { content: data.github_repo.slice(0, 2000) } }],
    };
  }
  if (data.final_status) {
    properties['Status'] = { status: { name: data.final_status } };
  }

  if (Object.keys(properties).length === 0) {
    return { success: true, updated_page_id: notion_page_id, noop: true };
  }

  try {
    const response = await fetch(`https://api.notion.com/v1/pages/${notion_page_id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
      },
      body: JSON.stringify({ properties }),
    });
    if (!response.ok) {
      const err = await response.text();
      console.warn(`[NOTION] updateGithubMetadata patch failed: ${err}`);
      return { success: false, error: err };
    }
    return { success: true, updated_page_id: notion_page_id };
  } catch (error: any) {
    console.warn(`[NOTION] updateGithubMetadata exception: ${error.message}`);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

export async function findPublisherPageByGithubRepo(fullNameOrUrl: string): Promise<string | null> {
  const databaseId = env.NOTION_DATABASE_ID;
  if (!notionToken || !databaseId || !fullNameOrUrl) return null;

  const needle = fullNameOrUrl.trim();
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${notionToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    },
    body: JSON.stringify({
      page_size: 5,
      filter: {
        property: 'GitHub Repo',
        rich_text: { equals: needle },
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.warn(`[NOTION] findPublisherPageByGithubRepo failed: ${err}`);
    return null;
  }
  const result = await response.json();
  return result.results?.[0]?.id || null;
}

export async function createPublisherGithubCatalogPage(input: {
  full_name: string;
  html_url: string;
  description?: string;
  owner: string;
}) {
  const databaseId = env.NOTION_DATABASE_ID;
  if (!notionToken || !databaseId) {
    return { success: false, error: 'Missing NOTION_TOKEN or NOTION_DATABASE_ID' };
  }

  const properties: any = {
    Name: { title: [{ text: { content: input.full_name.slice(0, 2000) } }] },
    'GitHub Repo': {
      rich_text: [{ text: { content: input.full_name.slice(0, 2000) } }],
    },
    'GitHub Publish Status': { status: { name: 'Mapped' } },
    'Source Tags': { multi_select: [{ name: 'GitHub' }] },
    Layer: { select: { name: 'Products' } },
  };

  // Catalog owner selector (TheVeller | orgs). Optional if prop missing.
  if (input.owner) {
    properties['GitHub Org'] = { select: { name: input.owner } };
  }

  if (input.description) {
    properties['Release Notes'] = {
      rich_text: [
        {
          text: {
            content: `${input.html_url}\n\n${input.description}`.slice(0, 2000),
          },
        },
      ],
    };
  } else {
    properties['Release Notes'] = {
      rich_text: [{ text: { content: input.html_url.slice(0, 2000) } }],
    };
  }

  try {
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties,
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      console.warn(`[NOTION] createPublisherGithubCatalogPage failed: ${err}`);
      return { success: false, error: err };
    }
    const page = await response.json();
    return { success: true, page_id: page.id as string };
  } catch (error: any) {
    return { success: false, error: error.message || 'Unknown error' };
  }
}

export type ComposioPublishStatus = 'Not started' | 'In progress' | 'Failed' | 'Published';

export type ComposioRedditKind = 'self' | 'link';

export interface ComposioRedditContent {
  title: string;
  body: string;
  subreddit: string;
  link_url: string;
  kind: ComposioRedditKind;
  channels: string[];
  composio_user_id: string;
  composio_connected_account_id: string;
  is_complete: boolean;
  missing: string[];
}

const _urlProp = (p: any): string => (typeof p?.url === 'string' ? p.url.trim() : '');

const _multiSelectNames = (p: any): string[] =>
  (p?.multi_select || []).map((x: any) => (x?.name || '').trim()).filter(Boolean);

function normalizeSubreddit(raw: string): string {
  return raw.trim().replace(/^r\//i, '');
}

/**
 * Publisher Composio + Reddit props → create payload.
 * kind: explicit option, else link if Reddit Link URL / Image / Screenshot, else self.
 */
export function extractComposioRedditContent(
  props: any,
  options: { kind?: ComposioRedditKind } = {}
): ComposioRedditContent {
  const r = createPropertyReader(props || {});
  const missing: string[] = [];
  const title = r.richText(PN.redditTitle) || r.title(PN.name) || '';
  const body = r.richText(PN.redditBody);
  const subreddit =
    normalizeSubreddit(r.richText(PN.redditSubreddit)) ||
    normalizeSubreddit(env.COMPOSIO_REDDIT_SUBREDDIT);
  const linkFromProp = r.url(PN.redditLinkUrl);
  const mediaUrl = r.fileUrl(PN.image) || r.fileUrl(PN.screenshot) || '';
  const link_url = linkFromProp || mediaUrl;
  const channels = r.multiSelect(PN.channels);
  const composio_user_id = r.richText(PN.composioUserId);
  const composio_connected_account_id = r.richText(PN.composioConnectedAccountId);

  let kind: ComposioRedditKind = options.kind || (link_url ? 'link' : 'self');
  if (options.kind === 'link' && !link_url) {
    missing.push('Reddit Link URL (or Image / Screenshot) for kind=link');
  }
  if (options.kind === 'self' && !body) {
    missing.push('Reddit Body for kind=self');
  }
  if (!options.kind) {
    if (kind === 'link' && !link_url) kind = 'self';
    if (kind === 'self' && !body && link_url) kind = 'link';
  }

  if (!title) missing.push('Reddit Title (or Name)');
  if (!subreddit) missing.push('Reddit Subreddit (or COMPOSIO_REDDIT_SUBREDDIT)');
  if (kind === 'self' && !body) missing.push('Reddit Body');
  if (kind === 'link' && !link_url) missing.push('Reddit Link URL (or Image / Screenshot)');

  return {
    title,
    body,
    subreddit,
    link_url,
    kind,
    channels,
    composio_user_id,
    composio_connected_account_id,
    is_complete: missing.length === 0,
    missing,
  };
}

export interface ComposioEventbriteContent {
  name: string;
  description_html: string;
  start_raw: string;
  end_raw: string;
  timezone: string;
  currency: string;
  organization_id: string;
  venue_id: string;
  online_event: boolean;
  channels: string[];
  composio_user_id: string;
  composio_connected_account_id: string;
  is_complete: boolean;
  missing: string[];
}

const _checkbox = (p: any): boolean => p?.checkbox === true;

/**
 * Publisher Composio + Eventbrite props → EVENTBRITE_CREATE_EVENT arguments.
 */
export function extractComposioEventbriteContent(props: any): ComposioEventbriteContent {
  const r = createPropertyReader(props || {});
  const missing: string[] = [];
  const name =
    r.richText(PN.eventbriteTitle) ||
    r.title(PN.name) ||
    '';
  const description_html =
    r.richText(PN.eventbriteDescription) ||
    r.richText(PN.caption) ||
    '';
  const start_raw = r.dateStart(PN.eventbriteStart) || r.dateStart(PN.lumaStart);
  const end_raw =
    r.dateEnd(PN.eventbriteEnd) ||
    r.dateStart(PN.eventbriteEnd) ||
    r.dateEnd(PN.eventbriteStart) ||
    r.dateEnd(PN.lumaEnd) ||
    '';
  const timezone =
    r.richText(PN.eventbriteTimezone) ||
    env.GUMROAD_AUTOPILOT_TIMEZONE ||
    'America/Lima';
  const currency =
    r.richText(PN.eventbriteCurrency) ||
    env.COMPOSIO_EVENTBRITE_CURRENCY ||
    'USD';
  const organization_id =
    r.richText(PN.eventbriteOrganizationId) ||
    env.COMPOSIO_EVENTBRITE_ORGANIZATION_ID;
  const venue_id = r.richText(PN.eventbriteVenueId);
  const online_event = r.checkbox(PN.eventbriteOnline);
  const channels = r.multiSelect(PN.channels);
  const composio_user_id = r.richText(PN.composioUserId);
  const composio_connected_account_id =
    r.richText(PN.eventbriteConnectedAccountId) ||
    r.richText(PN.composioConnectedAccountId);

  if (!name) missing.push('Eventbrite Title (or Name)');
  if (!start_raw) missing.push('Eventbrite Start');
  if (!end_raw) missing.push('Eventbrite End');
  if (!organization_id) missing.push('Eventbrite Organization ID (or COMPOSIO_EVENTBRITE_ORGANIZATION_ID)');

  return {
    name,
    description_html,
    start_raw,
    end_raw,
    timezone,
    currency,
    organization_id,
    venue_id,
    online_event,
    channels,
    composio_user_id,
    composio_connected_account_id,
    is_complete: missing.length === 0,
    missing,
  };
}

export async function updateComposioRedditMetadata(
  notion_page_id: string,
  data: {
    composio_status?: ComposioPublishStatus;
    reddit_url?: string;
    composio_url?: string;
    final_status?: FinalStatus;
  }
) {
  if (!notionToken || !notion_page_id) {
    return { success: false, error: 'Missing notion token or page id' };
  }

  const properties: any = {};
  if (data.composio_status) {
    properties['Composio Publish Status'] = { status: { name: data.composio_status } };
  }
  if (data.reddit_url) {
    properties['Reddit URL'] = { url: data.reddit_url };
  }
  if (data.composio_url) {
    properties['Composio URL'] = { url: data.composio_url };
  }
  if (data.final_status) {
    properties['Status'] = { status: { name: data.final_status } };
  }

  if (Object.keys(properties).length === 0) {
    return { success: true, updated_page_id: notion_page_id, noop: true };
  }

  try {
    const response = await fetch(`https://api.notion.com/v1/pages/${notion_page_id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
      },
      body: JSON.stringify({ properties }),
    });
    if (!response.ok) {
      const err = await response.text();
      console.warn(`[NOTION] updateComposioRedditMetadata patch failed: ${err}`);
      return { success: false, error: err };
    }
    return { success: true, updated_page_id: notion_page_id };
  } catch (error: any) {
    console.warn(`[NOTION] updateComposioRedditMetadata exception: ${error.message}`);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

export type PostizPublishStatus = 'Not started' | 'In progress' | 'Failed' | 'Published';

export interface PostizNotionContent {
  caption: string;
  targets: string[];
  schedule_at: string;
  overrides: Record<string, string>;
  settings: Record<string, Record<string, unknown>>;
  integration_ids: Record<string, string>;
  media_url?: string;
  is_complete: boolean;
  missing: string[];
}

/**
 * Publisher Postiz props → per-channel content + provider settings.
 * Empty channel override → shared Caption. Targets from `Postiz Targets` or `Channels`.
 */
export function extractPostizContent(props: any): PostizNotionContent {
  const r = createPropertyReader(props || {});
  const missing: string[] = [];
  const caption = r.richText(PN.caption) || r.richText(PN.povText) || '';
  const targets = [
    ...r.multiSelect(PN.postizTargets),
    ...r.multiSelect(PN.channels),
  ].filter((name, i, all) => all.indexOf(name) === i);

  const overrideKeys: Record<string, string> = {
    discord: PN.postizDiscord,
    slack: PN.postizSlack,
    mastodon: PN.postizMastodon,
    skool: PN.postizSkool,
    twitch: PN.postizTwitch,
    kick: PN.postizKick,
    warpcast: PN.postizFarcaster,
    nostr: PN.postizNostr,
    lemmy: PN.postizLemmy,
    listmonk: PN.postizListmonk,
  };

  const overrides: Record<string, string> = {};
  for (const [id, key] of Object.entries(overrideKeys)) {
    const text = r.richText(key);
    if (text) overrides[id] = text;
  }
  if (r.richText(PN.postizWarpcast)) {
    overrides.warpcast = overrides.warpcast || r.richText(PN.postizWarpcast);
  }

  const settings: Record<string, Record<string, unknown>> = {
    discord: { channel: r.richText(PN.postizDiscordChannel) || env.POSTIZ_DISCORD_CHANNEL },
    slack: { channel: r.richText(PN.postizSlackChannel) || env.POSTIZ_SLACK_CHANNEL },
    skool: {
      group: r.richText(PN.postizSkoolGroup) || env.POSTIZ_SKOOL_GROUP,
      label: r.richText(PN.postizSkoolLabel) || env.POSTIZ_SKOOL_LABEL,
      title: r.richText(PN.postizSkoolTitle) || r.title(PN.name),
    },
    twitch: {
      messageType: r.richText(PN.postizTwitchMessageType) || 'message',
      announcementColor: r.richText(PN.postizTwitchAnnouncementColor) || 'primary',
    },
    warpcast: {
      channels: r.richText(PN.postizWarpcastChannels) || r.richText(PN.postizFarcasterChannels),
    },
    lemmy: {
      community: r.richText(PN.postizLemmyCommunity),
      community_id: r.richText(PN.postizLemmyCommunityId),
      title: r.richText(PN.postizLemmyTitle) || r.title(PN.name),
      url: r.url(PN.postizLemmyUrl),
    },
    listmonk: {
      subject: r.richText(PN.postizListmonkSubject) || r.title(PN.name),
      preview: r.richText(PN.postizListmonkPreview) || caption.slice(0, 140),
      list: r.richText(PN.postizListmonkList) || env.POSTIZ_LISTMONK_LIST,
      template: r.richText(PN.postizListmonkTemplate),
    },
  };

  const integration_ids: Record<string, string> = {};
  const notionIntegrationKeys: Record<string, string> = {
    discord: PN.postizDiscordIntegrationId,
    slack: PN.postizSlackIntegrationId,
    mastodon: PN.postizMastodonIntegrationId,
    skool: PN.postizSkoolIntegrationId,
    twitch: PN.postizTwitchIntegrationId,
    kick: PN.postizKickIntegrationId,
    warpcast: PN.postizWarpcastIntegrationId,
    nostr: PN.postizNostrIntegrationId,
    lemmy: PN.postizLemmyIntegrationId,
    listmonk: PN.postizListmonkIntegrationId,
  };
  for (const [id, key] of Object.entries(notionIntegrationKeys)) {
    const value = r.richText(key);
    if (value) integration_ids[id] = value;
  }

  const schedule_at = r.dateStart(PN.postizSchedule) || r.dateStart(PN.schedule);
  const media_url = r.fileUrl(PN.image) || r.fileUrl(PN.gif) || r.fileUrl(PN.video) || undefined;

  if (!caption && !Object.keys(overrides).length) {
    missing.push('Caption (or a Postiz {Channel} override)');
  }

  return {
    caption,
    targets,
    schedule_at,
    overrides,
    settings,
    integration_ids,
    media_url,
    is_complete: missing.length === 0,
    missing,
  };
}

export async function updatePostizMetadata(
  notion_page_id: string,
  data: {
    postiz_status?: PostizPublishStatus;
    postiz_urls?: string;
    final_status?: FinalStatus;
  }
) {
  if (!notionToken || !notion_page_id) {
    return { success: false, error: 'Missing notion token or page id' };
  }

  const properties: any = {};
  if (data.postiz_status) {
    properties['Postiz Publish Status'] = { status: { name: data.postiz_status } };
  }
  if (data.postiz_urls) {
    properties['Postiz URLs'] = { rich_text: [{ text: { content: data.postiz_urls } }] };
  }
  if (data.final_status) {
    properties['Status'] = { status: { name: data.final_status } };
  }

  if (Object.keys(properties).length === 0) {
    return { success: true, updated_page_id: notion_page_id, noop: true };
  }

  try {
    const response = await fetch(`https://api.notion.com/v1/pages/${notion_page_id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
      },
      body: JSON.stringify({ properties }),
    });
    if (!response.ok) {
      const err = await response.text();
      console.warn(`[NOTION] updatePostizMetadata patch failed: ${err}`);
      return { success: false, error: err };
    }
    return { success: true, updated_page_id: notion_page_id };
  } catch (error: any) {
    console.warn(`[NOTION] updatePostizMetadata exception: ${error.message}`);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

export type TypefullyPublishStatus = 'Not started' | 'In progress' | 'Failed' | 'Published';

export interface TypefullyNotionContent {
  draft_title: string;
  caption: string;
  thread: string;
  social_set_id: string;
  platforms: Partial<Record<'x' | 'linkedin' | 'threads' | 'mastodon' | 'bluesky', string>>;
  plan_at: string;
  is_complete: boolean;
  missing: string[];
}

/**
 * Shared Caption + optional channel overrides → Typefully v2 platforms.
 * Typefully Thread is appended with 4 newlines (API thread split).
 */
export function extractTypefullyContent(props: any): TypefullyNotionContent {
  const r = createPropertyReader(props || {});
  const missing: string[] = [];
  const caption = r.richText(PN.caption) || r.richText(PN.povText) || '';
  const thread = r.richText(PN.typefullyThread);
  const x = r.richText(PN.xPost) || r.richText(PN.twitterPost);
  const linkedin = r.richText(PN.linkedinPost);
  const threads = r.richText(PN.threadsPost) || r.richText(PN.twitterPost);
  const mastodon = r.richText(PN.typefullyMastodon);
  const bluesky = r.richText(PN.typefullyBluesky);

  const withThread = (text: string) => {
    const base = text || caption;
    if (thread && base) return `${base}\n\n\n\n${thread}`;
    return base || thread;
  };

  const platforms: TypefullyNotionContent['platforms'] = {};
  const xText = withThread(x);
  const liText = withThread(linkedin);
  const thText = withThread(threads);
  const maText = withThread(mastodon);
  const bsText = withThread(bluesky);

  if (xText) platforms.x = xText;
  if (liText) platforms.linkedin = liText;
  if (thText) platforms.threads = thText;
  if (maText) platforms.mastodon = maText;
  if (bsText) platforms.bluesky = bsText;

  if (!Object.keys(platforms).length && caption) {
    platforms.x = withThread('');
  }

  const social_set_id =
    r.richText(PN.typefullyAccount) ||
    r.richText(PN.typefullySocialSetId) ||
    env.TYPEFULLY_SOCIAL_SET_ID;
  const draft_title = r.title(PN.name) || r.richText(PN.typefullyTitle);
  const plan_at = r.dateStart(PN.typefullySchedule) || r.dateStart(PN.schedule);

  if (!Object.keys(platforms).length) missing.push('Caption (or a Typefully / X / LinkedIn override)');
  if (!social_set_id) missing.push('Typefully Account (or TYPEFULLY_SOCIAL_SET_ID)');

  return {
    draft_title,
    caption,
    thread,
    social_set_id,
    platforms,
    plan_at,
    is_complete: missing.length === 0,
    missing,
  };
}

export async function updateTypefullyMetadata(
  notion_page_id: string,
  data: {
    typefully_status?: TypefullyPublishStatus;
    typefully_url?: string;
    final_status?: FinalStatus;
  }
) {
  if (!notionToken || !notion_page_id) {
    return { success: false, error: 'Missing notion token or page id' };
  }

  const properties: any = {};
  if (data.typefully_status) {
    properties['Typefully Publish Status'] = { status: { name: data.typefully_status } };
  }
  if (data.typefully_url) {
    properties['Typefully URL'] = { url: data.typefully_url };
  }
  if (data.final_status) {
    properties['Status'] = { status: { name: data.final_status } };
  }

  if (Object.keys(properties).length === 0) {
    return { success: true, updated_page_id: notion_page_id, noop: true };
  }

  try {
    const response = await fetch(`https://api.notion.com/v1/pages/${notion_page_id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
      },
      body: JSON.stringify({ properties }),
    });
    if (!response.ok) {
      const err = await response.text();
      console.warn(`[NOTION] updateTypefullyMetadata patch failed: ${err}`);
      return { success: false, error: err };
    }
    return { success: true, updated_page_id: notion_page_id };
  } catch (error: any) {
    console.warn(`[NOTION] updateTypefullyMetadata exception: ${error.message}`);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

export type RestreamPublishStatus = 'Not started' | 'In progress' | 'Failed' | 'Published';

export interface RestreamNotionContent {
  title: string;
  description: string;
  scheduled_for: string;
  stream_type: string;
  file_id: string;
  is_complete: boolean;
  missing: string[];
}

export function extractRestreamContent(props: any): RestreamNotionContent {
  const r = createPropertyReader(props || {});
  const missing: string[] = [];
  const title =
    r.richText(PN.restreamTitle) ||
    r.title(PN.name) ||
    '';
  const description =
    r.richText(PN.restreamDescription) ||
    r.richText(PN.caption) ||
    '';
  const scheduled_for =
    r.dateStart(PN.restreamStart) ||
    r.dateStart(PN.restreamSchedule) ||
    r.dateStart(PN.schedule);
  const stream_type =
    r.select(PN.restreamStreamType) ||
    r.richText(PN.restreamStreamType) ||
    'encoder';
  const file_id = r.richText(PN.restreamFileId);

  if (!title) missing.push('Restream Title (or Name)');

  return {
    title,
    description,
    scheduled_for,
    stream_type,
    file_id,
    is_complete: missing.length === 0,
    missing,
  };
}

export async function updateRestreamMetadata(
  notion_page_id: string,
  data: {
    restream_status?: RestreamPublishStatus;
    restream_url?: string;
    final_status?: FinalStatus;
  }
) {
  if (!notionToken || !notion_page_id) {
    return { success: false, error: 'Missing notion token or page id' };
  }

  const properties: any = {};
  if (data.restream_status) {
    properties['Restream Publish Status'] = { status: { name: data.restream_status } };
  }
  if (data.restream_url) {
    properties['Restream URL'] = { url: data.restream_url };
  }
  if (data.final_status) {
    properties['Status'] = { status: { name: data.final_status } };
  }

  if (Object.keys(properties).length === 0) {
    return { success: true, updated_page_id: notion_page_id, noop: true };
  }

  try {
    const response = await fetch(`https://api.notion.com/v1/pages/${notion_page_id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
      },
      body: JSON.stringify({ properties }),
    });
    if (!response.ok) {
      const err = await response.text();
      console.warn(`[NOTION] updateRestreamMetadata patch failed: ${err}`);
      return { success: false, error: err };
    }
    return { success: true, updated_page_id: notion_page_id };
  } catch (error: any) {
    console.warn(`[NOTION] updateRestreamMetadata exception: ${error.message}`);
    return { success: false, error: error.message || 'Unknown error' };
  }
}
