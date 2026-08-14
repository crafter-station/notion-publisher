import { env } from '../config/env';

const API_BASE = 'https://public-api.luma.com';

export interface LumaCreateEventInput {
  name: string;
  start_at: string;
  timezone: string;
  end_at?: string;
  description_md?: string;
  meeting_url?: string;
  /** Manual address string → geo_address_json { type: 'manual', address } */
  location?: string;
  visibility?: 'public' | 'members-only' | 'private';
  /** Must be images.lumacdn.com — use uploadCoverFromSource */
  cover_url?: string;
}

export interface LumaEventDetail {
  id: string;
  name?: string;
  url?: string;
  start_at?: string;
  end_at?: string;
  timezone?: string;
  cover_url?: string;
  description_md?: string;
  description?: string;
  geo_address_json?: { type?: string; address?: string; description?: string } | null;
  meeting_url?: string | null;
}

export function isLumaConfigured(): boolean {
  return !!env.LUMA_API_KEY;
}

export class LumaService {
  private headers: Record<string, string>;

  constructor(apiKey: string = env.LUMA_API_KEY) {
    if (!apiKey) {
      throw new Error('LUMA_API_KEY is not configured');
    }
    this.headers = {
      'x-luma-api-key': apiKey,
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
      // Never include api key in thrown errors
      throw new Error(`Luma ${method} ${path} → ${response.status}: ${message}`);
    }

    return parsed as T;
  }

  getSelf() {
    return this.request<{ user?: unknown; email?: string }>('GET', '/v1/users/get-self');
  }

  createUploadUrl(content_type: 'image/jpeg' | 'image/png' = 'image/jpeg') {
    return this.request<{ upload_url: string; file_url: string }>(
      'POST',
      '/v1/images/create-upload-url',
      { content_type }
    );
  }

  /**
   * Fetch remote image → Luma CDN file_url suitable for cover_url.
   * Only jpeg/png supported by Luma upload API.
   */
  async uploadCoverFromSource(sourceUrl: string): Promise<string> {
    const imgRes = await fetch(sourceUrl);
    if (!imgRes.ok) {
      throw new Error(`Cover source fetch → ${imgRes.status}`);
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const headerCt = (imgRes.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    let content_type: 'image/jpeg' | 'image/png' = 'image/jpeg';
    if (headerCt === 'image/png' || sourceUrl.toLowerCase().includes('.png')) {
      content_type = 'image/png';
    } else if (headerCt === 'image/jpeg' || headerCt === 'image/jpg') {
      content_type = 'image/jpeg';
    } else if (buf[0] === 0x89 && buf[1] === 0x50) {
      content_type = 'image/png';
    }

    const { upload_url, file_url } = await this.createUploadUrl(content_type);
    const put = await fetch(upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': content_type },
      body: buf,
    });
    if (!put.ok) {
      const errText = await put.text().catch(() => '');
      throw new Error(`Luma cover PUT → ${put.status}: ${errText.slice(0, 200)}`);
    }
    return file_url;
  }

  /** Create returns { id } only — call getEvent for public url. */
  createEvent(input: LumaCreateEventInput) {
    const body: Record<string, unknown> = {
      name: input.name,
      start_at: input.start_at,
      timezone: input.timezone,
    };
    if (input.end_at) body.end_at = input.end_at;
    if (input.description_md) body.description_md = input.description_md;
    if (input.meeting_url) body.meeting_url = input.meeting_url;
    if (input.visibility) body.visibility = input.visibility;
    if (input.cover_url) body.cover_url = input.cover_url;
    const loc = input.location?.trim();
    if (loc) {
      if (/^https?:\/\//i.test(loc)) {
        body.meeting_url = body.meeting_url || loc;
      } else {
        body.geo_address_json = { type: 'manual', address: loc };
      }
    }
    return this.request<{ id: string }>('POST', '/v1/events/create', body);
  }

  getEvent(eventId: string) {
    const q = new URLSearchParams({ event_id: eventId });
    return this.request<LumaEventDetail>('GET', `/v1/events/get?${q}`);
  }

  async listCalendarEvents(maxPages = 20): Promise<LumaEventDetail[]> {
    const all: LumaEventDetail[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < maxPages; i++) {
      const q = new URLSearchParams({ pagination_limit: '50' });
      if (cursor) q.set('pagination_cursor', cursor);
      const body = await this.request<any>('GET', `/v1/calendars/events/list?${q}`);
      const entries = Array.isArray(body?.entries)
        ? body.entries
        : Array.isArray(body?.data)
          ? body.data
          : [];
      for (const e of entries) {
        const ev = e.event || e;
        if (ev?.id) all.push(ev as LumaEventDetail);
      }
      const next =
        body.next_cursor || body.pagination?.next_cursor || body.meta?.pagination?.cursor;
      const hasMore = body.has_more ?? body.meta?.pagination?.hasMore ?? !!next;
      if (!hasMore || !next) break;
      cursor = String(next);
    }
    return all;
  }
}
