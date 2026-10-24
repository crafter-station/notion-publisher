import { env } from '../config/env';
import {
  ConnectorResult,
  isDryRun,
  livePublishAllowed,
  PublishModeOptions,
} from '../connectors/dry-run';

export const TYPEFULLY_API_BASE = 'https://api.typefully.com';

/** Typefully v2 platforms we ship (text-first). */
export const TYPEFULLY_PLATFORMS = ['x', 'linkedin', 'threads', 'mastodon', 'bluesky'] as const;
export type TypefullyPlatform = (typeof TYPEFULLY_PLATFORMS)[number];

export type TypefullyPlatformConfig =
  | { enabled: true; posts: Array<{ text: string }> }
  | { enabled: false };

/** Exact POST /v2/social-sets/{id}/drafts body. Never includes publish_at. */
export type TypefullyCreateDraftPayload = {
  platforms: Partial<Record<TypefullyPlatform, TypefullyPlatformConfig>>;
  draft_title?: string;
  scratchpad_text?: string;
  share: boolean;
  tags?: string[];
  /** Dated but inert — never auto-publishes until confirmed in Typefully. */
  plan_at?: string;
};

export type TypefullyDraftInput = {
  social_set_id: number;
  draft_title?: string;
  scratchpad_text?: string;
  share?: boolean;
  tags?: string[];
  /** ISO 8601 or next-free-slot → plan_at only (not publish_at). */
  plan_at?: string;
  platforms: Partial<Record<TypefullyPlatform, string>>;
};

export function isTypefullyConfigured(): boolean {
  return !!env.TYPEFULLY_API_KEY;
}

export function parseTypefullySocialSetId(raw: string | number | undefined): number {
  const n = typeof raw === 'number' ? raw : Number(String(raw || '').trim());
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error('TYPEFULLY_SOCIAL_SET_ID must be a positive integer');
  }
  return n;
}

function splitThread(text: string): string[] {
  const parts = text.split(/\n{4,}/).map(p => p.trim()).filter(Boolean);
  return parts.length ? parts : [text.trim()];
}

export function buildTypefullyDraftPayload(input: TypefullyDraftInput): {
  social_set_id: number;
  path: string;
  payload: TypefullyCreateDraftPayload;
  missing: string[];
} {
  const missing: string[] = [];
  let social_set_id = 0;
  try {
    social_set_id = parseTypefullySocialSetId(input.social_set_id);
  } catch {
    missing.push('TYPEFULLY_SOCIAL_SET_ID (or Typefully Account)');
  }

  const platforms: TypefullyCreateDraftPayload['platforms'] = {};
  let enabled = 0;
  for (const name of TYPEFULLY_PLATFORMS) {
    const text = (input.platforms[name] || '').trim();
    if (text) {
      platforms[name] = { enabled: true, posts: splitThread(text).map(t => ({ text: t })) };
      enabled += 1;
    }
  }
  if (!enabled) missing.push('at least one Typefully platform with text');

  const payload: TypefullyCreateDraftPayload = {
    platforms,
    share: input.share ?? false,
  };
  if (input.draft_title?.trim()) payload.draft_title = input.draft_title.trim();
  if (input.scratchpad_text?.trim()) payload.scratchpad_text = input.scratchpad_text.trim();
  if (input.tags?.length) payload.tags = input.tags;
  if (input.plan_at?.trim()) payload.plan_at = input.plan_at.trim();

  return {
    social_set_id,
    path: `/v2/social-sets/${social_set_id}/drafts`,
    payload,
    missing,
  };
}

export class TypefullyService {
  private headers: Record<string, string>;
  private base: string;

  constructor(apiKey: string = env.TYPEFULLY_API_KEY, base: string = TYPEFULLY_API_BASE) {
    this.headers = {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    this.base = base.replace(/\/$/, '');
  }

  private async request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
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
        parsed?.error?.message || parsed?.message || parsed?.error || text.slice(0, 300) || response.statusText;
      throw new Error(`Typefully ${method} ${path} → ${response.status}: ${message}`);
    }
    return parsed as T;
  }

  listSocialSets() {
    return this.request('GET', '/v2/social-sets?limit=50');
  }

  /**
   * Build the exact create-draft payload.
   * Dry-run (default) does not call Typefully.
   * Live requires TYPEFULLY_PUBLISH_LIVE=true and dryRun: false.
   * Never sends publish_at (drafts / plan_at only).
   */
  async createDraft(
    input: TypefullyDraftInput,
    options: PublishModeOptions = {}
  ): Promise<ConnectorResult<TypefullyCreateDraftPayload & { social_set_id: number; path: string }>> {
    const built = buildTypefullyDraftPayload(input);
    if (built.missing.length) {
      throw new Error(`Incomplete Typefully payload: ${built.missing.join('; ')}`);
    }
    if ('publish_at' in built.payload) {
      throw new Error('Typefully connector refuses publish_at');
    }

    const payload = {
      ...built.payload,
      social_set_id: built.social_set_id,
      path: built.path,
    };

    if (isDryRun(options) || !livePublishAllowed(env.TYPEFULLY_PUBLISH_LIVE)) {
      return { dry_run: true, called_publish: false, payload };
    }

    const { social_set_id: _id, path, ...body } = payload;
    const response = await this.request('POST', path, body);
    return { dry_run: false, called_publish: true, payload, response };
  }
}
