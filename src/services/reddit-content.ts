// Pure Notion → Reddit content mapping. No environment, network or schedulers.
const _richText = (p: any): string =>
  (p?.rich_text?.length ? p.rich_text.map((t: any) => t.plain_text).join('') : '').trim();
const _titleText = (p: any): string =>
  (p?.title?.length ? p.title.map((t: any) => t.plain_text).join('') : '').trim();
const _fileUrl = (p: any): string | undefined => {
  const f = p?.files?.[0];
  return f?.type === 'external' ? f.external?.url : f?.type === 'file' ? f.file?.url : undefined;
};

export type ComposioRedditKind = 'self' | 'link';

export interface ComposioRedditContent {
  title: string;
  body: string;
  subreddit: string;
  link_url: string;
  kind: ComposioRedditKind;
  flair_id: string;
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
  options: { kind?: ComposioRedditKind; defaultSubreddit?: string } = {}
): ComposioRedditContent {
  const missing: string[] = [];
  const title = _richText(props['Reddit Title']) || _titleText(props['Name']) || '';
  // Empty Notion overrides inherit Caption, matching the web Notion adapter.
  const body = _richText(props['Reddit Body']) || _richText(props['Caption']);
  const subreddit =
    normalizeSubreddit(_richText(props['Reddit Subreddit'])) ||
    normalizeSubreddit(options.defaultSubreddit || '');
  const linkFromProp = _urlProp(props['Reddit Link URL']);
  const mediaUrl = _fileUrl(props['Image']) || _fileUrl(props['Screenshot']) || '';
  const link_url = linkFromProp || mediaUrl;
  const channels = _multiSelectNames(props['Channels']);
  const composio_user_id = _richText(props['Composio User ID']);
  const composio_connected_account_id = _richText(props['Composio Connected Account ID']);

  const storedKind = props['Reddit Post Type']?.select?.name || '';
  if (storedKind && !['self', 'link'].includes(storedKind)) missing.push('Reddit Post Type must be self or link');
  const explicitKind = options.kind || (['self', 'link'].includes(storedKind) ? storedKind as ComposioRedditKind : undefined);
  const flair_id = _richText(props['Reddit Flair ID']).trim();
  let kind: ComposioRedditKind = explicitKind || (link_url ? 'link' : 'self');
  if (explicitKind === 'link' && !link_url) {
    missing.push('Reddit Link URL (or Image / Screenshot) for kind=link');
  }
  if (explicitKind === 'self' && !body) {
    missing.push('Reddit Body (or Caption) for kind=self');
  }
  if (!explicitKind) {
    if (kind === 'link' && !link_url) kind = 'self';
    if (kind === 'self' && !body && link_url) kind = 'link';
  }

  if (!title.trim()) missing.push('Reddit Title (or Name)');
  if (Array.from(title).length > 300) missing.push('Reddit Title must be at most 300 characters');
  if (subreddit && !/^[A-Za-z0-9_]+$/.test(subreddit)) missing.push('Reddit Subreddit must be a community name, not a URL');
  if (kind === 'self' && Array.from(body).length > 40000) missing.push('Reddit Body must be at most 40000 characters');
  if (kind === 'link' && link_url) {
    try {
      const parsed = new URL(link_url);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
    } catch { missing.push('Reddit Link URL must be an HTTP(S) URL without credentials'); }
  }
  if (flair_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(flair_id)) missing.push('Reddit Flair ID must be a flair template UUID for this subreddit');
  if (!subreddit) missing.push('Reddit Subreddit (or COMPOSIO_REDDIT_SUBREDDIT)');
  if (kind === 'self' && !body) missing.push('Reddit Body (or Caption)');
  if (kind === 'link' && !link_url) missing.push('Reddit Link URL (or Image / Screenshot)');

  return {
    title,
    body,
    subreddit,
    link_url,
    kind,
    flair_id,
    channels,
    composio_user_id,
    composio_connected_account_id,
    is_complete: missing.length === 0,
    missing,
  };
}
