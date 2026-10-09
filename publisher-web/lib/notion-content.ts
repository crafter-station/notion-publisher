import { redditSettings } from './channel-settings';
import { postizFields, postizVersionKey } from './postiz-versions';
import type { NotionProperty } from './server/notion';
export type Content = {
  title: string;
  body: string;
  versions: Record<string, string>;
  channelSettings?: Record<string, string>;
};
export function notionContent(
  properties: Record<string, NotionProperty>,
  mappingVersion = 4,
): Content {
  const text = (name: string) =>
    properties[name]?.rich_text?.map((t) => t.plain_text || '').join('') || '';
  const versions: Record<string, string> = {};
  for (const [channel, names] of Object.entries({
    X: ['X Post', 'Twitter Post'],
    LinkedIn: ['LinkedIn Post'],
    Instagram: ['Instagram Caption'],
    YouTube: ['YouTube Caption'],
    Reddit: ['Reddit Body'],
    Bluesky: ['Typefully Bluesky', 'Bluesky Post'],
    Mastodon: ['Typefully Mastodon'],
    ...(mappingVersion >= 2
      ? {
          Threads: ['Twitter Post'],
          Facebook: ['Facebook Post'],
          TikTok: ['TikTok Caption'],
          Pinterest: ['Pinterest Description'],
        }
      : {}),
  })) {
    const value = names.map(text).find(Boolean);
    if (value) versions[channel] = value;
  }
  if (mappingVersion >= 2 && text('Typefully Thread').trim()) {
    const first = versions.X || text('Caption');
    versions.X = first
      ? first + '\n\n\n\n' + text('Typefully Thread')
      : text('Typefully Thread');
  }
  if (mappingVersion >= 3) {
    for (const [channel, field] of Object.entries(postizFields)) {
      const value = text(field);
      if (value) versions[postizVersionKey(channel)] = value;
    }
  }
  const channelSettings: Record<string, string> = {};
  if (mappingVersion >= 4)
    for (const [key, spec] of Object.entries(redditSettings)) {
      const p = properties[spec.notion];
      const value =
        spec.type === 'rich_text'
          ? text(spec.notion)
          : spec.type === 'select'
            ? p?.select?.name
            : p?.url;
      if (value) channelSettings[key] = value;
    }
  return {
    ...(Object.keys(channelSettings).length ? { channelSettings } : {}),
    title:
      Object.values(properties)
        .find((p) => p.type === 'title')
        ?.title?.map((t) => t.plain_text || '')
        .join('') || 'Sin título',
    body: text('Caption'),
    versions,
  };
}

// Store the exact projection used at import/pull. Mapping upgrades must not
// retroactively reinterpret the merge baseline as user deletions.
export function notionSnapshot(properties: Record<string, NotionProperty>) {
  return JSON.stringify({
    mappingVersion: 4,
    properties,
    content: notionContent(properties),
  });
}
export function notionBaseline(snapshot: string): Content {
  const data = JSON.parse(snapshot);
  return [2, 3, 4].includes(data.mappingVersion) &&
    data.content &&
    data.properties
    ? (data.content as Content)
    : notionContent(data as Record<string, NotionProperty>, 1);
}

function fields(content: Content): Record<string, string> {
  return {
    title: content.title,
    body: content.body,
    ...Object.fromEntries(
      Object.entries(content.channelSettings || {}).map(([key, value]) => [
        'channelSettings.' + key,
        value,
      ]),
    ),
    ...Object.fromEntries(
      Object.entries(content.versions).map(([key, value]) => [
        'versions.' + key,
        value,
      ]),
    ),
  };
}
export function mergeNotionContent(
  baseline: Content,
  local: Content,
  remote: Content,
) {
  const before = fields(baseline),
    here = fields(local),
    there = fields(remote);
  const keys = [
    ...new Set([
      ...Object.keys(before),
      ...Object.keys(here),
      ...Object.keys(there),
    ]),
  ].sort();
  const merged: Record<string, string> = {};
  const conflicts: {
    field: string;
    baseline?: string;
    local?: string;
    remote?: string;
  }[] = [];
  let localChanged = false,
    remoteChanged = false,
    changesDraft = false;
  for (const field of keys) {
    const l = here[field] !== before[field],
      r = there[field] !== before[field];
    localChanged ||= l;
    remoteChanged ||= r;
    if (l && r && here[field] !== there[field])
      conflicts.push({
        field,
        baseline: before[field],
        local: here[field],
        remote: there[field],
      });
    const value = l ? here[field] : there[field];
    changesDraft ||= value !== here[field];
    if (value !== undefined) merged[field] = value;
  }
  return {
    localChanged,
    remoteChanged,
    changesDraft,
    conflicts,
    content: {
      ...(Object.keys(merged).some((key) => key.startsWith('channelSettings.'))
        ? {
            channelSettings: Object.fromEntries(
              Object.entries(merged)
                .filter(([key]) => key.startsWith('channelSettings.'))
                .map(([key, value]) => [key.slice(16), value]),
            ),
          }
        : {}),
      title: merged.title,
      body: merged.body,
      versions: Object.fromEntries(
        Object.entries(merged)
          .filter(([key]) => key.startsWith('versions.'))
          .map(([key, value]) => [key.slice(9), value]),
      ),
    },
  };
}

export function resolveNotionConflicts(
  plan: ReturnType<typeof mergeNotionContent>,
  choices: unknown,
) {
  if (!choices || typeof choices !== 'object' || Array.isArray(choices))
    throw new Error('Elige una versión para cada conflicto.');
  const selected = choices as Record<string, unknown>;
  if (
    Object.keys(selected).length !== plan.conflicts.length ||
    plan.conflicts.some(
      (c) =>
        !Object.hasOwn(selected, c.field) ||
        (selected[c.field] !== 'local' && selected[c.field] !== 'notion'),
    )
  )
    throw new Error('Elige Editor o Notion para cada conflicto actual.');
  const content: Content = {
    ...plan.content,
    versions: { ...plan.content.versions },
    ...(plan.content.channelSettings
      ? { channelSettings: { ...plan.content.channelSettings } }
      : {}),
  };
  let changesDraft = plan.changesDraft;
  for (const conflict of plan.conflicts) {
    if (selected[conflict.field] === 'local') continue;
    const value = conflict.remote;
    changesDraft ||= value !== conflict.local;
    if (conflict.field === 'title' || conflict.field === 'body')
      content[conflict.field] = value ?? '';
    else if (conflict.field.startsWith('channelSettings.')) {
      const key = conflict.field.slice(16);
      content.channelSettings = { ...content.channelSettings };
      if (value === undefined) delete content.channelSettings[key];
      else content.channelSettings[key] = value;
    } else {
      const channel = conflict.field.slice('versions.'.length);
      if (value === undefined) delete content.versions[channel];
      else content.versions = { ...content.versions, [channel]: value };
    }
  }
  return { ...plan, content, changesDraft, conflicts: [] };
}
