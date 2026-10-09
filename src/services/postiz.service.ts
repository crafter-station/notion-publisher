import { providerRequest } from './provider-http';

export type PostizEntry = {
  integration: { id: string };
  value: { content: string; image: { id: string; path: string; [setting: string]: unknown }[] }[];
  settings: { __type: string; [setting: string]: unknown };
};

export class PostizService {
  constructor(private apiKey: string, private base = 'https://api.postiz.com/public/v1') {}
  listIntegrations() {
    return providerRequest<{ id: string; identifier: string; disabled: boolean; name: string }[]>(this.base, '/integrations', this.apiKey);
  }
  createPosts(posts: PostizEntry[], mode: 'draft' | 'schedule' | 'now' = 'draft', date = new Date().toISOString()) {
    if (!['draft', 'schedule', 'now'].includes(mode)) throw new Error('Invalid publication mode');
    if (!posts.length || posts.some(post => !post.integration.id.trim() || !post.settings.__type.trim() || !post.value.length)) throw new Error('Each post requires an integration, platform and content');
    if (!Number.isFinite(Date.parse(date)) || (mode === 'schedule' && Date.parse(date) <= Date.now())) throw new Error('Invalid publication date');
    return providerRequest<{ postId: string; integration: string }[]>(this.base, '/posts', this.apiKey, 'POST', { type: mode, date, shortLink: false, tags: [], posts });
  }
}
