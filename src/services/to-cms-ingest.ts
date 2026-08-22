/**
 * Build Notion page property payloads for /to-cms ingest.
 * Inverse of extract* helpers — only documented live props.
 */
export type ResolvedIngest = {
  title: string;
  layers: string[];
  sources: string[];
  channels: string[];
  pages: Array<{
    layer: string;
    sources: string[];
    channels: string[];
    statusProps: string[];
    title: string;
    fields: Record<string, string>;
  }>;
  missing: string[];
  recommended: string[];
  buttons: string[];
  ok: boolean;
};

export type IngestPagePayload = {
  layer: string;
  properties: Record<string, unknown>;
};

function rt(content: string) {
  return { rich_text: [{ text: { content: content.slice(0, 2000) } }] };
}
function title(content: string) {
  return { title: [{ text: { content: content.slice(0, 2000) } }] };
}
function multi(names: string[]) {
  return { multi_select: names.map(name => ({ name })) };
}
function status(name: string) {
  return { status: { name } };
}
function select(name: string) {
  return { select: { name } };
}
function urlProp(u: string) {
  return { url: u };
}

function field(fields: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (fields[k]?.trim()) return fields[k].trim();
  }
  return '';
}

export function buildIngestPages(resolved: ResolvedIngest): IngestPagePayload[] {
  return resolved.pages.map(page => {
    const f = page.fields || {};
    const properties: Record<string, unknown> = {
      Name: title(page.title),
      Layer: select(page.layer),
      'Source Tags': multi(page.sources),
    };
    if (page.channels.length) {
      properties['Channels'] = multi(page.channels);
    }
    for (const sp of page.statusProps) {
      properties[sp] = status('Not started');
    }

    if (page.sources.includes('Gumroad')) {
      const gTitle = field(f, 'Gumroad Title') || page.title;
      properties['Gumroad Title'] = rt(gTitle);
      const landing = field(f, 'Landing Page Copy');
      if (landing) properties['Landing Page Copy'] = rt(landing);
      const template = field(f, 'Template');
      if (template) properties['Template'] = rt(template);
    }

    if (page.sources.includes('Postly')) {
      const caption = field(f, 'Caption', 'POV', 'POV Text');
      if (caption) properties['Caption'] = rt(caption);
      const image = field(f, 'Image', 'Screenshot', 'GIF', 'Video');
      if (image.startsWith('http')) {
        // files external when URL; else skip (agent can attach later)
        properties['Image'] = {
          files: [{ name: 'media', type: 'external', external: { url: image } }],
        };
      }
    }

    if (page.sources.includes('Composio') || page.channels.includes('Reddit')) {
      const rtTitle = field(f, 'Reddit Title') || page.title;
      properties['Reddit Title'] = rt(rtTitle);
      const body = field(f, 'Reddit Body');
      if (body) properties['Reddit Body'] = rt(body);
      const sub = field(f, 'Reddit Subreddit');
      if (sub) properties['Reddit Subreddit'] = rt(sub);
      const link = field(f, 'Reddit Link URL');
      if (link.startsWith('http')) properties['Reddit Link URL'] = urlProp(link);
    }

    if (page.sources.includes('Luma')) {
      const lTitle = field(f, 'Luma Title', 'Luma Name') || page.title;
      properties['Luma Title'] = rt(lTitle);
      const desc = field(f, 'Luma Description');
      if (desc) properties['Luma Description'] = rt(desc);
      const loc = field(f, 'Luma Location');
      if (loc) properties['Luma Location'] = rt(loc);
      const start = field(f, 'Luma Start');
      if (start) properties['Luma Start'] = { date: { start } };
    }

    if (page.sources.includes('GitHub')) {
      const repo = field(f, 'GitHub Repo');
      if (repo) properties['GitHub Repo'] = rt(repo);
      const tag = field(f, 'Release Tag');
      if (tag) properties['Release Tag'] = rt(tag);
      const notes = field(f, 'Release Notes');
      if (notes) properties['Release Notes'] = rt(notes);
      const landing = field(f, 'Landing Page Copy');
      if (landing) properties['Landing Page Copy'] = rt(landing);
    }

    return { layer: page.layer, properties };
  });
}
