import { env } from '../config/env';

const API_BASE = 'https://api.github.com';

/** Product pipeline: Releases only under this login (personal account). */
export const GITHUB_PRODUCT_OWNER = 'TheVeller';

export const GITHUB_CATALOG_OWNERS = [
  'TheVeller',
  'Nucleo-Lab',
  'crafter-station',
  'GPT-Chain',
] as const;

export type GithubRepoMeta = {
  full_name: string;
  owner: string;
  name: string;
  html_url: string;
  description: string;
  default_branch: string;
  private: boolean;
  topics: string[];
};

export type GithubRelease = {
  id: number;
  html_url: string;
  tag_name: string;
  draft: boolean;
};

export function isGithubConfigured(): boolean {
  return !!env.GITHUB_TOKEN;
}

function assertProductOwner(owner: string) {
  if (owner !== GITHUB_PRODUCT_OWNER) {
    throw new Error(
      `GitHub product pipeline: owner must be ${GITHUB_PRODUCT_OWNER} (got ${owner})`
    );
  }
}

export class GithubService {
  private headers: Record<string, string>;

  constructor(token: string = env.GITHUB_TOKEN) {
    if (!token) {
      throw new Error('GITHUB_TOKEN is not configured');
    }
    this.headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'notion-publisher',
    };
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const headers: Record<string, string> = { ...this.headers };
    let payload: string | undefined;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: payload,
    });

    const text = await response.text();
    let parsed: any = {};
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text.slice(0, 200) };
      }
    }

    if (!response.ok) {
      const message = parsed?.message || text.slice(0, 300) || response.statusText;
      throw new Error(`GitHub ${method} ${path} → ${response.status}: ${message}`);
    }

    return parsed as T;
  }

  private mapRepo(r: any): GithubRepoMeta {
    return {
      full_name: r.full_name,
      owner: r.owner?.login || String(r.full_name || '').split('/')[0],
      name: r.name,
      html_url: r.html_url,
      description: r.description || '',
      default_branch: r.default_branch || 'main',
      private: !!r.private,
      topics: Array.isArray(r.topics) ? r.topics : [],
    };
  }

  async getRepo(owner: string, repo: string): Promise<GithubRepoMeta> {
    const r = await this.request<any>('GET', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
    return this.mapRepo(r);
  }

  /**
   * List repos for a user or org (metadata only).
   * User: only repos owned by that login (affiliation=owner when self; else /users/:owner/repos).
   * Org: /orgs/:owner/repos.
   */
  async listReposForOwner(owner: string, maxPages = 5): Promise<GithubRepoMeta[]> {
    const all: GithubRepoMeta[] = [];

    let pathBase = `/orgs/${encodeURIComponent(owner)}/repos`;
    let queryExtra = 'type=all';
    try {
      await this.request<any[]>('GET', `${pathBase}?per_page=1&${queryExtra}`);
    } catch {
      // User account path
      const me = await this.request<any>('GET', '/user');
      if (me?.login && String(me.login).toLowerCase() === owner.toLowerCase()) {
        pathBase = '/user/repos';
        queryExtra = 'affiliation=owner';
      } else {
        pathBase = `/users/${encodeURIComponent(owner)}/repos`;
        queryExtra = 'type=owner';
      }
    }

    for (let page = 1; page <= maxPages; page++) {
      const batch = await this.request<any[]>(
        'GET',
        `${pathBase}?per_page=100&page=${page}&sort=updated&${queryExtra}`
      );
      if (!Array.isArray(batch) || batch.length === 0) break;
      for (const r of batch) {
        const meta = this.mapRepo(r);
        if (meta.owner.toLowerCase() !== owner.toLowerCase()) continue;
        all.push(meta);
      }
      if (batch.length < 100) break;
    }
    return all;
  }

  async ensureRepo(owner: string, name: string, opts?: { private?: boolean; description?: string }) {
    assertProductOwner(owner);
    try {
      return await this.getRepo(owner, name);
    } catch {
      const created = await this.request<any>('POST', '/user/repos', {
        name,
        private: opts?.private ?? true,
        description: opts?.description || '',
        auto_init: true,
      });
      return this.mapRepo(created);
    }
  }

  async updateRepo(input: {
    owner: string;
    repo: string;
    description?: string;
    homepage?: string;
    topics?: string[];
  }): Promise<GithubRepoMeta> {
    assertProductOwner(input.owner);
    const path = `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}`;
    const patch: Record<string, string> = {};
    if (input.description !== undefined) patch.description = input.description.slice(0, 350);
    if (input.homepage !== undefined) patch.homepage = input.homepage;
    const updated =
      Object.keys(patch).length > 0
        ? await this.request<any>('PATCH', path, patch)
        : await this.request<any>('GET', path);

    if (input.topics && input.topics.length > 0) {
      await this.request('PUT', `${path}/topics`, { names: input.topics });
    }

    const meta = this.mapRepo(updated);
    if (input.topics) meta.topics = input.topics;
    return meta;
  }

  /**
   * Create or update a file via Contents API (UTF-8 string or binary Buffer).
   */
  async putFile(input: {
    owner: string;
    repo: string;
    path: string;
    content: string | Buffer;
    message: string;
    branch?: string;
  }) {
    assertProductOwner(input.owner);
    const encOwner = encodeURIComponent(input.owner);
    const encRepo = encodeURIComponent(input.repo);
    const encPath = input.path
      .split('/')
      .map(p => encodeURIComponent(p))
      .join('/');
    const apiPath = `/repos/${encOwner}/${encRepo}/contents/${encPath}`;

    let sha: string | undefined;
    try {
      const existing = await this.request<any>('GET', apiPath);
      sha = existing?.sha;
    } catch {
      // create
    }

    const contentB64 =
      typeof input.content === 'string'
        ? Buffer.from(input.content, 'utf8').toString('base64')
        : input.content.toString('base64');

    return this.request('PUT', apiPath, {
      message: input.message,
      content: contentB64,
      ...(sha ? { sha } : {}),
      ...(input.branch ? { branch: input.branch } : {}),
    });
  }

  async createRelease(input: {
    owner: string;
    repo: string;
    tag: string;
    name?: string;
    body?: string;
    draft?: boolean;
  }): Promise<GithubRelease> {
    assertProductOwner(input.owner);
    const release = await this.request<any>(
      'POST',
      `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/releases`,
      {
        tag_name: input.tag,
        name: input.name || input.tag,
        body: input.body || '',
        draft: input.draft ?? false,
        generate_release_notes: false,
      }
    );
    return {
      id: release.id,
      html_url: release.html_url,
      tag_name: release.tag_name,
      draft: !!release.draft,
    };
  }

  async uploadReleaseAsset(input: {
    owner: string;
    repo: string;
    releaseId: number;
    fileName: string;
    bytes: Buffer;
    contentType?: string;
  }) {
    assertProductOwner(input.owner);
    const q = new URLSearchParams({ name: input.fileName });
    // Uploads go to uploads.github.com
    const url = `https://uploads.github.com/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/releases/${input.releaseId}/assets?${q}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.headers.Authorization,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': input.contentType || 'application/octet-stream',
        'Content-Length': String(input.bytes.length),
        'User-Agent': 'notion-publisher',
      },
      body: new Uint8Array(input.bytes),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`GitHub upload asset → ${response.status}: ${text.slice(0, 300)}`);
    }
    return text ? JSON.parse(text) : {};
  }
}
