const notionToken = process.env.NOTION_TOKEN;

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
