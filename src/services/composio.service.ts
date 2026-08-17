import { env } from '../config/env';

const API_BASE = 'https://backend.composio.dev/api/v3.1';

/** Pin Reddit toolkit version from Composio catalog (20260724_00). */
export const COMPOSIO_REDDIT_TOOLKIT_VERSION = '20260724_00';
export const REDDIT_CREATE_POST_SLUG = 'REDDIT_CREATE_REDDIT_POST';

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

  createRedditPost(
    args: RedditCreatePostArgs,
    auth: { userId: string; connectedAccountId?: string }
  ) {
    const payload: Record<string, unknown> = {
      subreddit: args.subreddit.replace(/^r\//i, ''),
      title: args.title.slice(0, 300),
    };
    if (args.kind) payload.kind = args.kind;
    if (args.text) payload.text = args.text;
    if (args.url) payload.url = args.url;
    if (args.flair_id) payload.flair_id = args.flair_id;

    return this.executeTool(REDDIT_CREATE_POST_SLUG, {
      userId: auth.userId,
      connectedAccountId: auth.connectedAccountId,
      arguments: payload,
    });
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
