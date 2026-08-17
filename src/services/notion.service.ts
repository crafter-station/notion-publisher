import { env } from '../config/env';
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
  const missing: string[] = [];

  const caption_instagram = _richText(props['Instagram Caption']);
  const caption_facebook = _richText(props['Facebook Post']);
  const caption_linkedin = _richText(props['LinkedIn Post']);
  const caption_tiktok = _richText(props['TikTok Caption']);
  const caption_threads = _richText(props['Twitter Post']);
  const pinterest_title = _richText(props['Pinterest Title']);
  const pinterest_description = _richText(props['Pinterest Description']);
  const youtube_title = _richText(props['YouTube Title']);
  const youtube_caption = _richText(props['YouTube Caption']);
  const first_comment = _richText(props['Universal First Comment']);
  // ponytail: Caption preferred when set; POV Text kept as legacy alias
  const caption = _richText(props['Caption']);
  const pov_text = _richText(props['POV Text']);
  const brand = _selectName(props['Brand']);
  const select = _selectName(props['Select']);
  const source_url = props['url']?.url || '';

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
  const videoUrl = _fileUrl(props['Video']);
  const gifUrl = _fileUrl(props['GIF']);
  const imageUrl = _fileUrl(props['Image']);
  const screenshotUrl = _fileUrl(props['Screenshot']);

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
  const missing: string[] = [];
  const name =
    _richText(props['Luma Title']) ||
    _richText(props['Luma Name']) ||
    _titleText(props['Name']) ||
    '';
  const start_at = _dateStart(props['Luma Start']);
  const end_at = _dateEnd(props['Luma End']) || _dateStart(props['Luma End']) || '';
  const location = _richText(props['Luma Location']);
  const description_md = _richText(props['Luma Description']);
  const cover_url = _fileUrl(props['Luma Cover']);
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
  const missing: string[] = [];
  const repoRaw = _richText(props['GitHub Repo']);
  const parsed = parseGithubRepoField(repoRaw);
  const owner = parsed?.owner || '';
  const repo = parsed?.repo || '';
  const full_name = owner && repo ? `${owner}/${repo}` : '';
  let tag = _richText(props['Release Tag']);
  const release_notes = _richText(props['Release Notes']);
  const landing_page_md = _richText(props['Landing Page Copy']);
  const asset_url = _fileUrl(props['GitHub Asset']) || _fileUrl(props['File']);
  const template_json = _richText(props['Template']);
  const gumroad_url = props['Gumroad URL']?.url || '';
  const cover_url = _fileUrl(props['Gumroad Cover']) || undefined;
  const thumbnail_url = _fileUrl(props['Gumroad Thumbnail']) || undefined;
  const title =
    _richText(props['Gumroad Title']) ||
    _titleText(props['Name']) ||
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
  const missing: string[] = [];
  const title = _richText(props['Reddit Title']) || _titleText(props['Name']) || '';
  const body = _richText(props['Reddit Body']);
  const subreddit =
    normalizeSubreddit(_richText(props['Reddit Subreddit'])) ||
    normalizeSubreddit(env.COMPOSIO_REDDIT_SUBREDDIT);
  const linkFromProp = _urlProp(props['Reddit Link URL']);
  const mediaUrl = _fileUrl(props['Image']) || _fileUrl(props['Screenshot']) || '';
  const link_url = linkFromProp || mediaUrl;
  const channels = _multiSelectNames(props['Channels']);
  const composio_user_id = _richText(props['Composio User ID']);
  const composio_connected_account_id = _richText(props['Composio Connected Account ID']);

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
