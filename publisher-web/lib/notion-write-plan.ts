import { redditSettings, parseChannelSettings } from './channel-settings';
import { notionContent, type Content } from './notion-content';
import { postizFields, postizVersionKey } from './postiz-versions';
import type { NotionProperty } from './server/notion';

type TextValue = { type: 'text'; text: { content: string } };
type PropertyWrite =
  | { title: TextValue[] }
  | { rich_text: TextValue[] }
  | { url: string | null }
  | { select: { name: string } | null };

// Notion limits text.content to 2,000 characters and rich-text arrays to 100.
// Count UTF-16 units conservatively without splitting surrogate pairs.
function richText(value: string): TextValue[] {
  const chunks: string[] = [];
  let chunk = '';
  for (const character of value) {
    if (chunk.length + character.length > 2000) {
      chunks.push(chunk);
      chunk = '';
    }
    chunk += character;
  }
  if (chunk) chunks.push(chunk);
  if (chunks.length > 100)
    throw new Error('El texto supera el límite de Notion.');
  return chunks.map((content) => ({ type: 'text', text: { content } }));
}

// Pure preflight only. The eventual writer must reread/merge current Notion
// content, journal the attempt and reconcile uncertain writes before retrying.
export function notionWritePlan(
  properties: Record<string, NotionProperty>,
  desired: Content,
) {
  const before = notionContent(properties);
  const simulated = structuredClone(properties);
  const patch: Record<string, PropertyWrite> = {};
  function set(
    name: string | undefined,
    value: string,
    type: 'title' | 'rich_text' = 'rich_text',
  ) {
    if (!name || properties[name]?.type !== type)
      throw new Error(
        `Falta un campo ${type} compatible en Notion: ${name || 'título'}.`,
      );
    const current =
      properties[name][type]?.map((part) => part.plain_text || '').join('') ||
      '';
    if (current === value) return;
    const text = richText(value);
    patch[name] = type === 'title' ? { title: text } : { rich_text: text };
    simulated[name] = {
      type,
      [type]: text.map((part) => ({ plain_text: part.text.content })),
    };
  }
  if (desired.title !== before.title)
    set(
      Object.keys(properties).find((key) => properties[key].type === 'title'),
      desired.title,
      'title',
    );
  if (desired.body !== before.body) set('Caption', desired.body);

  const mapping: Record<string, string[]> = {
    LinkedIn: ['LinkedIn Post'],
    Instagram: ['Instagram Caption'],
    YouTube: ['YouTube Caption'],
    Reddit: ['Reddit Body'],
    Bluesky: ['Typefully Bluesky', 'Bluesky Post'],
    Mastodon: ['Typefully Mastodon'],
    Threads: ['Twitter Post'],
    Facebook: ['Facebook Post'],
    TikTok: ['TikTok Caption'],
    Pinterest: ['Pinterest Description'],
    ...Object.fromEntries(
      Object.entries(postizFields).map(([channel, field]) => [
        postizVersionKey(channel),
        [field],
      ]),
    ),
  };
  for (const channel of new Set([
    ...Object.keys(before.versions),
    ...Object.keys(desired.versions),
  ])) {
    if (before.versions[channel] === desired.versions[channel]) continue;
    const value = desired.versions[channel] ?? '';
    if (channel === 'X') {
      const [first, ...rest] = value.split('\n\n\n\n');
      set(properties['X Post'] ? 'X Post' : 'Twitter Post', first);
      if (properties['Typefully Thread'] || rest.length)
        set('Typefully Thread', rest.join('\n\n\n\n'));
    } else {
      const names = mapping[channel];
      if (!names)
        throw new Error(
          `El canal ${channel} todavía no tiene un campo de salida en Notion.`,
        );
      set(names.find((name) => properties[name]) || names[0], value);
      // Clear lower-priority aliases when deleting, otherwise the importer
      // would silently restore their stale values on the next pull.
      if (!value)
        for (const name of names.slice(1)) if (properties[name]) set(name, '');
    }
  }
  const settings = parseChannelSettings(desired.channelSettings || {});
  for (const [key, spec] of Object.entries(redditSettings)) {
    const value = settings[key] || '';
    if (value === (before.channelSettings?.[key] || '')) continue;
    if (properties[spec.notion]?.type !== spec.type)
      throw new Error('Falta el campo de Notion: ' + spec.notion);
    if (spec.type === 'rich_text') set(spec.notion, value);
    else if (spec.type === 'url') {
      patch[spec.notion] = { url: value || null };
      simulated[spec.notion] = { type: 'url', url: value || null };
    } else {
      patch[spec.notion] = { select: value ? { name: value } : null };
      simulated[spec.notion] = {
        type: 'select',
        select: value ? { name: value } : null,
      };
    }
  }
  const roundTrip = notionContent(simulated);
  const keys = new Set([
    ...Object.keys(roundTrip.versions),
    ...Object.keys(desired.versions),
  ]);
  if (
    Object.keys({ ...roundTrip.channelSettings, ...settings }).some(
      (key) => roundTrip.channelSettings?.[key] !== settings[key],
    ) ||
    roundTrip.title !== desired.title ||
    roundTrip.body !== desired.body ||
    [...keys].some((key) => roundTrip.versions[key] !== desired.versions[key])
  )
    throw new Error(
      'El esquema de Notion no representa estos cambios sin alterar otro campo. Revisa los alias, las variantes vacías y los hilos.',
    );
  if (
    new TextEncoder().encode(JSON.stringify({ properties: patch })).length >
    500000
  )
    throw new Error(
      'Los cambios superan el tamaño máximo de una petición de Notion.',
    );
  return { properties: patch, fields: Object.keys(patch) };
}
