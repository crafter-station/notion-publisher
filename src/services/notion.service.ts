import { env } from '../config/env';

const notionToken = env.NOTION_TOKEN;

export async function getNotionPage(pageId: string) {
  if (!notionToken) throw new Error('Missing NOTION_TOKEN');

  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28'
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

  // Extract Title
  let title = 'Untitled Chain';
  if (props['Gumroad Title'] && props['Gumroad Title'].rich_text && props['Gumroad Title'].rich_text.length > 0) {
    title = props['Gumroad Title'].rich_text.map((t: any) => t.plain_text).join('');
  } else if (props['Prompt Chain Template Name'] && props['Prompt Chain Template Name'].title && props['Prompt Chain Template Name'].title.length > 0) {
    title = props['Prompt Chain Template Name'].title.map((t: any) => t.plain_text).join('');
  } else {
    is_incomplete = true;
  }

  // Extract Description (Landing Page Copy)
  let description = 'Auto-published dataset';
  if (props['Landing Page Copy'] && props['Landing Page Copy'].rich_text && props['Landing Page Copy'].rich_text.length > 0) {
    description = props['Landing Page Copy'].rich_text.map((t: any) => t.plain_text).join('');
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

  const cover_url = getFileUrl(props['Gumroad Cover']?.files);
  const thumbnail_url = getFileUrl(props['Gumroad Thumbnail']?.files);

  const gumroad_product_id = props['Gumroad Product ID']?.rich_text?.[0]?.plain_text || undefined;
  const public_url = props['Gumroad URL']?.url || undefined;

  return {
    id: pageData.id,
    title,
    description,
    chain_json,
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
        'Notion-Version': '2022-06-28'
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

export type InstagramStatus = 'Not started' | 'In progress' | 'Failed' | 'Published';
export type FinalStatus =
  | 'Not started' | 'In progress' | 'Published'
  | 'Published (EN)' | 'Published (ES)' | 'Published (PT)'
  | 'Postly Error' | 'Render Error' | 'Done';

export interface PostlyContent {
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
  const pov_text = _richText(props['POV Text']);

  // Global fallback: POV Text → else first non-empty caption
  const global_text =
    pov_text ||
    caption_instagram ||
    caption_facebook ||
    caption_linkedin ||
    pinterest_description ||
    youtube_caption ||
    caption_threads ||
    caption_tiktok ||
    '';

  if (!global_text) missing.push('All caption fields empty (POV Text + per-platform)');

  // Media priority: Video → GIF → Screenshot
  const videoUrl = _fileUrl(props['Video']);
  const gifUrl = _fileUrl(props['GIF']);
  const screenshotUrl = _fileUrl(props['Screenshot']);

  let media_url: string | undefined;
  let media_type: PostlyContent['media_type'] = 'image/jpeg';

  if (videoUrl) {
    media_url = videoUrl;
    media_type = 'video/mp4';
  } else if (gifUrl) {
    media_url = gifUrl;
    media_type = 'image/gif';
  } else if (screenshotUrl) {
    media_url = screenshotUrl;
    media_type = /\.png(\?|$)/i.test(screenshotUrl) ? 'image/png' : 'image/jpeg';
  } else {
    missing.push('Video / GIF / Screenshot (no media file attached)');
  }

  return {
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

/**
 * Writes Postly publishing status back to Notion AI POVs page.
 * - `Instagram Status` (status): granular task state during the 6-phase loop
 * - `Instagram URL` (url): first published URL
 * - `Post ID` (rich_text): multi-line `<platform>: <id>`
 * - `Status` (status): final aggregate — Published (EN) on full success, Postly Error otherwise
 *
 * Each field is sent independently; a single property error doesn't abort the whole patch
 * (we log warnings but never throw).
 */
export async function updatePostlyMetadata(
  notion_page_id: string,
  data: {
    instagram_status?: InstagramStatus;
    instagram_url?: string;
    post_id?: string;
    final_status?: FinalStatus;
  }
) {
  if (!notionToken || !notion_page_id) {
    return { success: false, error: 'Missing notion token or page id' };
  }

  const properties: any = {};

  if (data.instagram_status) {
    properties['Instagram Status'] = { status: { name: data.instagram_status } };
  }
  if (data.instagram_url) {
    properties['Instagram URL'] = { url: data.instagram_url };
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
        'Notion-Version': '2022-06-28',
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

