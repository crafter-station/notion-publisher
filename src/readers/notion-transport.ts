import { NOTION_VERSION } from '../services/notion.service';

export type NotionPage = {
  id: string;
  url?: string;
  properties?: Record<string, any>;
};

export interface NotionTransport {
  getPage(pageId: string): Promise<NotionPage>;
  queryAll(databaseId: string, filter?: unknown): Promise<NotionPage[]>;
  createPage(databaseId: string, properties: Record<string, unknown>): Promise<NotionPage>;
  updatePage(pageId: string, properties: Record<string, unknown>): Promise<void>;
}

export function createHttpNotionTransport(token: string): NotionTransport {
  async function request(method: string, path: string, body?: unknown): Promise<any> {
    const res = await fetch(`https://api.notion.com/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Notion ${method} ${path}: ${text.slice(0, 400)}`);
    return text ? JSON.parse(text) : {};
  }

  return {
    async getPage(pageId) {
      return request('GET', `/pages/${pageId}`);
    },
    async queryAll(databaseId, filter) {
      const results: NotionPage[] = [];
      let cursor: string | undefined;
      do {
        const body: any = { page_size: 100 };
        if (filter) body.filter = filter;
        if (cursor) body.start_cursor = cursor;
        const page = await request('POST', `/databases/${databaseId}/query`, body);
        results.push(...(page.results || []));
        cursor = page.has_more ? page.next_cursor : undefined;
      } while (cursor);
      return results;
    },
    async createPage(databaseId, properties) {
      return request('POST', '/pages', { parent: { database_id: databaseId }, properties });
    },
    async updatePage(pageId, properties) {
      await request('PATCH', `/pages/${pageId}`, { properties });
    },
  };
}
