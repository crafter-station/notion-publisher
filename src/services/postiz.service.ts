import { env } from '../config/env';
import {
  ConnectorResult,
  isDryRun,
  livePublishAllowed,
  PublishModeOptions,
} from '../connectors/dry-run';
import {
  getPostizChannel,
  parsePostizIntegrations,
  POSTIZ_CHANNEL_CATALOG,
  PostizChannelCapability,
} from './postiz-channels.catalog';

/** Cloud default. Prefer POSTIZ_API_BASE for self-hosted (no paid plan assumed). */
export const POSTIZ_CLOUD_API_BASE = 'https://api.postiz.com/public/v1';

export type PostizPostType = 'draft' | 'schedule' | 'now';

export type PostizMedia = { id: string; path: string };

export type PostizSettings = Record<string, unknown> & { __type: string };

export type PostizPostItem = {
  integration: { id: string };
  value: Array<{ content: string; image: PostizMedia[] }>;
  settings: PostizSettings;
};

/** Exact POST /posts body from Postiz public API. */
export type PostizCreatePostPayload = {
  type: PostizPostType;
  date: string;
  shortLink: boolean;
  tags: unknown[];
  posts: PostizPostItem[];
};

export type PostizChannelInput = {
  identifier: string;
  integration_id: string;
  content: string;
  images?: PostizMedia[];
  settings?: Record<string, unknown>;
};

export type PostizCreateInput = {
  type?: PostizPostType;
  date?: string;
  shortLink?: boolean;
  tags?: unknown[];
  channels: PostizChannelInput[];
};

export type PostizContent = {
  caption: string;
  targets: string[];
  channels: PostizChannelInput[];
  schedule_at: string;
  type: PostizPostType;
  is_complete: boolean;
  missing: string[];
};

export function isPostizConfigured(): boolean {
  return !!env.POSTIZ_API_KEY;
}

export function postizApiBase(): string {
  const raw = (env.POSTIZ_API_BASE || '').replace(/\/$/, '');
  return raw || POSTIZ_CLOUD_API_BASE;
}

function defaultDate(): string {
  return new Date().toISOString();
}

function assertChannelSettings(
  channel: PostizChannelCapability,
  settings: PostizSettings
): string[] {
  const missing: string[] = [];
  for (const key of channel.requiredSettings) {
    const value = settings[key];
    if (value === undefined || value === null || value === '') {
      missing.push(`${channel.label} settings.${key}`);
      continue;
    }
    if (key === 'subreddit' && Array.isArray(value) && value.length === 0) {
      missing.push(`${channel.label} settings.subreddit (community)`);
    }
  }
  return missing;
}

export function buildPostizSettings(
  identifier: string,
  extras: Record<string, unknown> = {}
): PostizSettings {
  const channel = getPostizChannel(identifier);
  if (!channel) {
    throw new Error(`Unsupported Postiz channel: ${identifier}`);
  }

  const settings: PostizSettings = { __type: channel.settingsType };

  switch (channel.identifier) {
    case 'discord':
    case 'slack':
      if (extras.channel) settings.channel = String(extras.channel);
      break;
    case 'skool':
      if (extras.group) settings.group = String(extras.group);
      if (extras.label) settings.label = String(extras.label);
      if (extras.title) settings.title = String(extras.title);
      break;
    case 'twitch': {
      const messageType = String(extras.messageType || extras.message_type || 'message');
      settings.messageType = messageType === 'announcement' ? 'announcement' : 'message';
      if (settings.messageType === 'announcement') {
        const color = String(extras.announcementColor || extras.announcement_color || 'primary');
        settings.announcementColor = color;
      }
      break;
    }
    case 'warpcast': {
      const ids = Array.isArray(extras.channels)
        ? extras.channels
        : String(extras.channel || extras.channels || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
      if (ids.length) {
        settings.subreddit = ids.map(id => ({ value: { id: String(id) } }));
      }
      break;
    }
    case 'lemmy': {
      const community = String(extras.community || extras.subreddit || '');
      const id = String(extras.community_id || extras.id || community);
      const title = String(extras.title || '');
      const url = extras.url ? String(extras.url) : '';
      if (community || id || title) {
        settings.subreddit = [
          {
            value: {
              subreddit: community || id,
              id: id || community,
              title,
              url,
            },
          },
        ];
      }
      break;
    }
    case 'listmonk':
      if (extras.subject) settings.subject = String(extras.subject);
      if (extras.preview) settings.preview = String(extras.preview);
      if (extras.list) settings.list = String(extras.list);
      if (extras.template) settings.template = String(extras.template);
      break;
    default:
      break;
  }

  return settings;
}

export function buildPostizCreatePayload(input: PostizCreateInput): {
  payload: PostizCreatePostPayload;
  missing: string[];
} {
  const missing: string[] = [];
  if (!input.channels.length) missing.push('at least one Postiz channel');

  const posts: PostizPostItem[] = [];
  for (const ch of input.channels) {
    const spec = getPostizChannel(ch.identifier);
    if (!spec) {
      missing.push(`unsupported channel ${ch.identifier}`);
      continue;
    }
    if (!ch.integration_id) missing.push(`${spec.label} integration id`);
    if (!ch.content?.trim()) missing.push(`${spec.label} content`);

    const settings = {
      ...buildPostizSettings(ch.identifier, ch.settings || {}),
      ...(ch.settings?.__type ? {} : {}),
    };
    if (ch.settings && Object.keys(ch.settings).length) {
      Object.assign(settings, buildPostizSettings(ch.identifier, ch.settings));
    }
    missing.push(...assertChannelSettings(spec, settings));

    posts.push({
      integration: { id: ch.integration_id },
      value: [{ content: ch.content || '', image: ch.images || [] }],
      settings,
    });
  }

  let type: PostizPostType = input.type || (input.date ? 'schedule' : 'draft');
  if (type === 'now') {
    // Never emit immediate publish from the default builder.
    type = input.date ? 'schedule' : 'draft';
  }
  if (type === 'schedule' && !input.date) {
    missing.push('date (ISO 8601) for type=schedule');
  }

  const payload: PostizCreatePostPayload = {
    type,
    date: input.date || defaultDate(),
    shortLink: input.shortLink ?? false,
    tags: input.tags || [],
    posts,
  };

  return { payload, missing };
}

export function validatePostizPayload(payload: PostizCreatePostPayload): string[] {
  const { missing } = buildPostizCreatePayload({
    type: payload.type,
    date: payload.date,
    shortLink: payload.shortLink,
    tags: payload.tags,
    channels: payload.posts.map(p => ({
      identifier: String(p.settings.__type),
      integration_id: p.integration.id,
      content: p.value[0]?.content || '',
      images: p.value[0]?.image,
      settings: p.settings,
    })),
  });
  return missing;
}

export class PostizService {
  private headers: Record<string, string>;
  private base: string;

  constructor(
    apiKey: string = env.POSTIZ_API_KEY,
    base: string = postizApiBase()
  ) {
    this.headers = {
      Authorization: apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    this.base = base.replace(/\/$/, '');
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`${this.base}${path}`, {
      method,
      headers: this.headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let parsed: any;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { raw: text.slice(0, 200) };
    }
    if (!response.ok) {
      const message =
        parsed?.message || parsed?.error || text.slice(0, 300) || response.statusText;
      throw new Error(`Postiz ${method} ${path} → ${response.status}: ${message}`);
    }
    return parsed as T;
  }

  listIntegrations() {
    return this.request<unknown>('GET', '/integrations');
  }

  /**
   * Build + validate the exact POST /posts payload.
   * Dry-run (default) does not call the create endpoint.
   * Live requires POSTIZ_PUBLISH_LIVE=true and dryRun: false.
   * Immediate type=now is never sent.
   */
  async createPost(
    input: PostizCreateInput,
    options: PublishModeOptions = {}
  ): Promise<ConnectorResult<PostizCreatePostPayload>> {
    const { payload, missing } = buildPostizCreatePayload(input);
    if (missing.length) {
      throw new Error(`Incomplete Postiz payload: ${missing.join('; ')}`);
    }

    if (isDryRun(options) || !livePublishAllowed(env.POSTIZ_PUBLISH_LIVE)) {
      return { dry_run: true, called_publish: false, payload };
    }

    const response = await this.request('POST', '/posts', payload);
    return { dry_run: false, called_publish: true, payload, response };
  }
}

export function resolvePostizIntegrations(): { identifier: string; id: string }[] {
  if (!env.POSTIZ_INTEGRATIONS) return [];
  return parsePostizIntegrations(env.POSTIZ_INTEGRATIONS);
}

export function listWiredPostizChannels(): PostizChannelCapability[] {
  return POSTIZ_CHANNEL_CATALOG.slice();
}
