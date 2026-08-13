import { env } from '../config/env';

const API_BASE = 'https://api.myskool.xyz/v1';

export class SkoolService {
  private headers: Record<string, string>;

  constructor(apiKey: string = env.SKOOL_API_KEY) {
    if (!apiKey) {
      throw new Error('SKOOL_API_KEY is not configured');
    }
    this.headers = {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    };
  }

  private async request<T = unknown>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      headers: this.headers,
    });

    const text = await response.text();
    let body: any;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text.slice(0, 200) };
    }

    if (!response.ok) {
      const code = body?.error?.code || body?.error || 'request_failed';
      const message = body?.error?.message || text.slice(0, 300) || response.statusText;
      // Never include Authorization / api key in thrown errors
      throw new Error(`MySkool ${path} → ${response.status} ${code}: ${message}`);
    }

    return (body?.data !== undefined ? body.data : body) as T;
  }

  listGroups() {
    return this.request<any[]>('/groups');
  }

  getGroup(groupId: string) {
    return this.request<any>(`/groups/${encodeURIComponent(groupId)}`);
  }

  listGroupPosts(groupId: string, pages = 1) {
    const q = pages > 1 ? `?pages=${pages}` : '';
    return this.request<any[]>(`/groups/${encodeURIComponent(groupId)}/posts${q}`);
  }

  getPost(postId: string, groupId?: string) {
    const q = groupId ? `?group=${encodeURIComponent(groupId)}` : '';
    return this.request<any>(`/posts/${encodeURIComponent(postId)}${q}`);
  }

  listComments(postId: string, groupId?: string) {
    const q = groupId ? `?group=${encodeURIComponent(groupId)}` : '';
    return this.request<any[]>(`/posts/${encodeURIComponent(postId)}/comments${q}`);
  }
}

export function isSkoolConfigured(): boolean {
  return !!env.SKOOL_API_KEY;
}
