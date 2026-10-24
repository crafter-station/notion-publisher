import { env } from '../config/env';
import {
  ConnectorResult,
  isDryRun,
  livePublishAllowed,
  PublishModeOptions,
} from '../connectors/dry-run';

const API_BASE = 'https://backend.composio.dev/api/v3.1';

/** Pin Reddit toolkit version from Composio catalog (20260724_00). */
export const COMPOSIO_REDDIT_TOOLKIT_VERSION = '20260724_00';
export const REDDIT_CREATE_POST_SLUG = 'REDDIT_CREATE_REDDIT_POST';
export const EVENTBRITE_CREATE_EVENT_SLUG = 'EVENTBRITE_CREATE_EVENT';

export type ComposioExecuteBody = {
  user_id: string;
  arguments: Record<string, unknown>;
  version: string;
  connected_account_id?: string;
};

export function isComposioConfigured(): boolean {
  return !!env.COMPOSIO_API_KEY;
}

export type ComposioConnectedAccount = {
  id: string;
  user_id?: string;
  status?: string;
  toolkit_slug?: string;
};

export type RedditCreatePostArgs = {
  subreddit: string;
  title: string;
  kind?: 'self' | 'link';
  text?: string;
  url?: string;
  flair_id?: string;
};

export type EventbriteCreateEventArgs = {
  organization_id: string;
  name: string;
  start_utc: string;
  end_utc: string;
  timezone: string;
  currency?: string;
  description_html?: string;
  online_event?: boolean;
  venue_id?: string;
  listed?: boolean;
};

export function toEventbriteUtc(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid Eventbrite datetime: ${raw}`);
  }
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function asHtml(text: string): string {
  const t = text.trim();
  if (!t) return '';
  if (/<[a-z][\s\S]*>/i.test(t)) return t;
  return `<p>${t}</p>`;
}

export function buildRedditExecuteBody(
  args: RedditCreatePostArgs,
  auth: { userId: string; connectedAccountId?: string }
): { body: ComposioExecuteBody; missing: string[] } {
  const missing: string[] = [];
  if (!auth.userId) missing.push('COMPOSIO_USER_ID');
  if (!args.subreddit) missing.push('subreddit');
  if (!args.title) missing.push('title');
  const payload: Record<string, unknown> = {
    subreddit: args.subreddit.replace(/^r\//i, ''),
    title: args.title.slice(0, 300),
  };
  if (args.kind) payload.kind = args.kind;
  if (args.text) payload.text = args.text;
  if (args.url) payload.url = args.url;
  if (args.flair_id) payload.flair_id = args.flair_id;
  const body: ComposioExecuteBody = {
    user_id: auth.userId,
    arguments: payload,
    version: COMPOSIO_REDDIT_TOOLKIT_VERSION,
  };
  if (auth.connectedAccountId) body.connected_account_id = auth.connectedAccountId;
  return { body, missing };
}

export function buildEventbriteExecuteBody(
  args: EventbriteCreateEventArgs,
  auth: { userId: string; connectedAccountId?: string }
): { body: ComposioExecuteBody; missing: string[] } {
  const missing: string[] = [];
  if (!auth.userId) missing.push('COMPOSIO_USER_ID');
  if (!args.organization_id) missing.push('organization_id');
  if (!args.name?.trim()) missing.push('event.name.html');
  if (!args.start_utc) missing.push('event.start.utc');
  if (!args.end_utc) missing.push('event.end.utc');
  if (!args.timezone) missing.push('event.start.timezone');

  const event: Record<string, unknown> = {
    name: { html: asHtml(args.name) },
    start: { utc: args.start_utc, timezone: args.timezone },
    end: { utc: args.end_utc, timezone: args.timezone },
    currency: (args.currency || env.COMPOSIO_EVENTBRITE_CURRENCY || 'USD').toUpperCase(),
  };
  if (args.description_html) event.description = { html: asHtml(args.description_html) };
  if (args.online_event) event.online_event = true;
  if (args.venue_id) event.venue_id = args.venue_id;
  if (args.listed !== undefined) event.listed = args.listed;

  const body: ComposioExecuteBody = {
    user_id: auth.userId,
    arguments: {
      organization_id: args.organization_id,
      event,
    },
    version: env.COMPOSIO_EVENTBRITE_TOOLKIT_VERSION || COMPOSIO_REDDIT_TOOLKIT_VERSION,
  };
  if (auth.connectedAccountId) body.connected_account_id = auth.connectedAccountId;
  return { body, missing };
}

export type ComposioToolExecuteResult = {
  successful?: boolean;
  error?: string;
  data?: unknown;
  raw: unknown;
};

export class ComposioService {
  private headers: Record<string, string>;

  constructor(apiKey: string = env.COMPOSIO_API_KEY) {
    if (!apiKey) {
      throw new Error('COMPOSIO_API_KEY is not configured');
    }
    this.headers = {
      'x-api-key': apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
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
        parsed?.message ||
        parsed?.error?.message ||
        parsed?.error ||
        text.slice(0, 300) ||
        response.statusText;
      throw new Error(`Composio ${method} ${path} → ${response.status}: ${message}`);
    }

    return parsed as T;
  }

  async listConnectedAccounts(opts: {
    toolkit?: string;
    limit?: number;
  } = {}): Promise<ComposioConnectedAccount[]> {
    const params = new URLSearchParams();
    if (opts.toolkit) params.append('toolkit_slugs', opts.toolkit);
    params.set('limit', String(opts.limit ?? 50));
    params.set('account_type', 'ALL');

    const data = await this.request<{ items?: any[] }>(
      'GET',
      `/connected_accounts?${params.toString()}`
    );

    return (data.items || []).map((item: any) => ({
      id: item.id,
      user_id: item.user_id || item.userId || item.entity_id,
      status: item.status,
      toolkit_slug: item.toolkit?.slug || item.toolkit_slug,
    }));
  }

  async executeTool(
    slug: string,
    opts: {
      userId: string;
      connectedAccountId?: string;
      arguments: Record<string, unknown>;
      version?: string;
    }
  ): Promise<ComposioToolExecuteResult> {
    const body: Record<string, unknown> = {
      user_id: opts.userId,
      arguments: opts.arguments,
      version: opts.version || COMPOSIO_REDDIT_TOOLKIT_VERSION,
    };
    if (opts.connectedAccountId) {
      body.connected_account_id = opts.connectedAccountId;
    }

    const raw = await this.request<any>('POST', `/tools/execute/${slug}`, body);
    return {
      successful: raw?.successful ?? raw?.data?.successful,
      error: raw?.error || raw?.data?.error,
      data: raw?.data ?? raw,
      raw,
    };
  }

  async createRedditPost(
    args: RedditCreatePostArgs,
    auth: { userId: string; connectedAccountId?: string },
    options: PublishModeOptions = {}
  ): Promise<ConnectorResult<ComposioExecuteBody, ComposioToolExecuteResult>> {
    const { body, missing } = buildRedditExecuteBody(args, auth);
    if (missing.length) throw new Error(`Incomplete Composio Reddit payload: ${missing.join('; ')}`);

    if (isDryRun(options) || !livePublishAllowed(env.COMPOSIO_PUBLISH_LIVE)) {
      return { dry_run: true, called_publish: false, payload: body };
    }

    const response = await this.executeTool(REDDIT_CREATE_POST_SLUG, {
      userId: auth.userId,
      connectedAccountId: auth.connectedAccountId,
      arguments: body.arguments,
      version: body.version,
    });
    return { dry_run: false, called_publish: true, payload: body, response };
  }

  async createEventbriteEvent(
    args: EventbriteCreateEventArgs,
    auth: { userId: string; connectedAccountId?: string },
    options: PublishModeOptions = {}
  ): Promise<ConnectorResult<ComposioExecuteBody, ComposioToolExecuteResult>> {
    const { body, missing } = buildEventbriteExecuteBody(args, auth);
    if (missing.length) {
      throw new Error(`Incomplete Composio Eventbrite payload: ${missing.join('; ')}`);
    }

    if (isDryRun(options) || !livePublishAllowed(env.COMPOSIO_PUBLISH_LIVE)) {
      return { dry_run: true, called_publish: false, payload: body };
    }

    const response = await this.executeTool(EVENTBRITE_CREATE_EVENT_SLUG, {
      userId: auth.userId,
      connectedAccountId: auth.connectedAccountId,
      arguments: body.arguments,
      version: body.version,
    });
    return { dry_run: false, called_publish: true, payload: body, response };
  }
}

/** Normalize Reddit permalink / relative path to absolute URL. */
function normalizeRedditUrl(value: string): string {
  const s = value.trim().replace(/[),.]+$/, '');
  if (!s) return '';
  if (/^https?:\/\/(?:www\.)?reddit\.com\//i.test(s)) return s;
  // Composio often returns relative: /r/test/comments/...
  if (/^\/r\//i.test(s)) return `https://www.reddit.com${s}`;
  return '';
}

/** Best-effort permalink extraction from Composio Reddit tool payload. */
export function extractRedditPermalink(result: ComposioToolExecuteResult): string {
  const walk = (node: unknown, depth = 0): string => {
    if (!node || depth > 6) return '';
    if (typeof node === 'string') {
      return normalizeRedditUrl(node) ||
        (() => {
          const m = node.match(/https?:\/\/(?:www\.)?reddit\.com\/[^\s"'<>]+/i);
          return m ? normalizeRedditUrl(m[0]) : '';
        })();
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        const hit = walk(item, depth + 1);
        if (hit) return hit;
      }
      return '';
    }
    if (typeof node === 'object') {
      const o = node as Record<string, unknown>;
      for (const key of ['permalink', 'url', 'link', 'reddit_url']) {
        if (typeof o[key] === 'string') {
          const hit = normalizeRedditUrl(o[key] as string);
          if (hit) return hit;
        }
      }
      // Fallback: thing id name like t3_1vq8fj1
      if (typeof o.name === 'string' && /^t3_/i.test(o.name)) {
        return `https://www.reddit.com/comments/${(o.name as string).slice(3)}/`;
      }
      for (const v of Object.values(o)) {
        const hit = walk(v, depth + 1);
        if (hit) return hit;
      }
    }
    return '';
  };
  return walk(result.data) || walk(result.raw);
}
