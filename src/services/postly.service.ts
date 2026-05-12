import { env } from '../config/env';

const API_BASE = 'https://openapi.postly.ai/v1';

export interface PostlyMedia {
  url: string;
  type: 'image/png' | 'image/jpeg' | 'video/mp4' | string;
}

export class PostlyService {
  private headers: Record<string, string>;

  constructor() {
    this.headers = {
      'X-API-Key': env.POSTLY_API_KEY,
      'Content-Type': 'application/json',
    };
  }

  async createPost(params: {
    workspace: string;
    target_platforms: string | string[];
    text: string;
    media: PostlyMedia[];
    platform_posts?: Array<{ identifier: string; settings: Record<string, any> }>;
  }) {
    const body: any = {
      workspace: params.workspace,
      target_platforms: Array.isArray(params.target_platforms)
        ? params.target_platforms.join(',')
        : params.target_platforms,
      text: params.text,
      media: params.media,
    };
    if (params.platform_posts && params.platform_posts.length > 0) {
      body.platform_posts = params.platform_posts;
    }

    const response = await fetch(`${API_BASE}/posts`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Postly create failed: ${err}`);
    }

    const result = await response.json();
    return result.data[0]; // Returns the created post object
  }

  async getPost(workspaceId: string, postId: string) {
    const response = await fetch(`${API_BASE}/posts/${postId}`, {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Postly get failed: ${err}`);
    }

    const result = await response.json();
    // Depending on Postly's single post response structure, the post might be in `data` or at the root.
    return result.data ? result.data : result;
  }

  async listPosts(workspaceId: string) {
    const response = await fetch(`${API_BASE}/posts?workspaceId=${workspaceId}`, {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Postly list failed: ${err}`);
    }

    const result = await response.json();
    return result.data || [];
  }
}
