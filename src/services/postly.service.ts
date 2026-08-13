import { env } from '../config/env';

const API_BASE = 'https://openapi.postly.ai/v1';

export interface PostlyMedia {
  url: string;
  type: 'image/png' | 'image/jpeg' | 'video/mp4' | string;
}

export interface PostlyTargetPlatform {
  identifier: string;
  id: string;
}

export interface PostlyPlatformPost {
  identifier: string;
  text_override?: string;
  media_override?: PostlyMedia[];
  settings?: Record<string, any>;
}

export class PostlyService {
  private headers: Record<string, string>;

  constructor() {
    this.headers = {
      'X-API-Key': env.POSTLY_API_KEY,
      'Content-Type': 'application/json',
    };
  }

  async listSocials(workspaceId: string = env.POSTLY_WORKSPACE_ID) {
    const response = await fetch(`${API_BASE}/workspaces/${workspaceId}/socials`, {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Postly listSocials failed: ${err}`);
    }

    const result = await response.json();
    return result.data || [];
  }

  async listAudienceGroups(workspaceId: string = env.POSTLY_WORKSPACE_ID) {
    const response = await fetch(`${API_BASE}/workspaces/${workspaceId}/audience-groups`, {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Postly listAudienceGroups failed: ${err}`);
    }

    const result = await response.json();
    return result.data || [];
  }

  /**
   * Create a post. OpenAPI anyOf: provide `target_platforms` and/or `audience_group`.
   * Existing callers keep passing target_platforms only.
   */
  async createPost(params: {
    workspace: string;
    target_platforms?: PostlyTargetPlatform[];
    audience_group?: string;
    text: string;
    media: PostlyMedia[];
    platform_posts?: PostlyPlatformPost[];
  }) {
    const hasTargets = !!(params.target_platforms && params.target_platforms.length > 0);
    const hasAudience = !!params.audience_group?.trim();
    if (!hasTargets && !hasAudience) {
      throw new Error('Postly createPost requires target_platforms or audience_group');
    }

    const body: Record<string, unknown> = {
      workspace: params.workspace,
      text: params.text,
      media: params.media,
    };

    if (hasTargets) {
      body.target_platforms = params.target_platforms!.map(platform => platform.id).join(',');
    }
    if (hasAudience) {
      body.audience_group = params.audience_group!.trim();
    }
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
    return Array.isArray(result.data) ? result.data[0] : result.data;
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
