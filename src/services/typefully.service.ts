import { providerId, providerRequest } from './provider-http';

export type TypefullyPost = { text: string; media_ids?: string[]; [setting: string]: unknown };
export type TypefullyDraftInput = {
  platforms: Record<string, { enabled: boolean; posts: TypefullyPost[]; [setting: string]: unknown }>;
  draft_title?: string;
  share?: boolean;
  publish_at?: string;
  [option: string]: unknown;
};

/** API v2 keys required. No env import: usable from CLI, tests and hosted workers. */
export class TypefullyService {
  constructor(private apiKey: string) {}
  private request<T>(path: string, method = 'GET', body?: unknown) {
    if (!this.apiKey.trim()) throw new Error('TYPEFULLY_API_KEY is missing');
    return providerRequest<T>('https://api.typefully.com/v2', path, `Bearer ${this.apiKey}`, method, body);
  }
  getMe() { return this.request<Record<string, unknown>>('/me'); }
  listSocialSets(offset = 0) {
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid offset');
    return this.request<{ results: Record<string, unknown>[]; next?: string | null }>('/social-sets?limit=50&offset=' + offset);
  }
  getDraft(account: string | number, draft: string | number) {
    return this.request<Record<string, unknown>>(`/social-sets/${providerId(account)}/drafts/${providerId(draft)}`);
  }
  createDraft(account: string | number, input: TypefullyDraftInput) {
    // Draft action cannot accidentally inherit an immediate/scheduled publication.
    if (input.publish_at !== undefined || input.plan_at !== undefined) throw new Error('Use explicit scheduling action');
    if (!Object.values(input.platforms).some(platform => platform.enabled && platform.posts.length)) throw new Error('At least one platform with posts is required');
    return this.request<Record<string, unknown>>(`/social-sets/${providerId(account)}/drafts`, 'POST', input);
  }
  scheduleDraft(account: string | number, draft: string | number, publishAt: string) {
    if (publishAt !== 'now' && publishAt !== 'next-free-slot' && (!Number.isFinite(Date.parse(publishAt)) || Date.parse(publishAt) <= Date.now())) throw new Error('A future publish time is required');
    return this.request<Record<string, unknown>>(`/social-sets/${providerId(account)}/drafts/${providerId(draft)}`, 'PATCH', { publish_at: publishAt });
  }
}
