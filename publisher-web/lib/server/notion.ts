import { env } from 'cloudflare:workers';
import { ApiError } from './context';

export type NotionProperty = {
  type: string;
  url?: string | null;
  files?: unknown[];
  title?: { plain_text?: string }[];
  rich_text?: { plain_text?: string }[];
  multi_select?: { name: string }[];
  status?: { name: string } | null;
  select?: { name: string } | null;
};
export type NotionPage = {
  id: string;
  url: string;
  last_edited_time: string;
  archived?: boolean;
  in_trash?: boolean;
  parent: { database_id?: string };
  properties: Record<string, NotionProperty>;
};
export async function notionInventory(cursor?: string) {
  const config = env as unknown as {
    NOTION_TOKEN?: string;
    NOTION_DATABASE_ID?: string;
  };
  if (!config.NOTION_TOKEN || !config.NOTION_DATABASE_ID)
    throw new ApiError(
      503,
      'notion_not_configured',
      'La conexión de Notion todavía no está configurada en este servidor.',
    );
  if (
    cursor &&
    (cursor.length > 4096 ||
      Array.from(cursor).some(
        (character) =>
          character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      ))
  )
    throw new ApiError(
      400,
      'invalid_cursor',
      'El cursor de Notion no es válido.',
    );
  const read = notionReader(config.NOTION_TOKEN);
  // The current integration is pinned to the legacy database API. Do not switch
  // to data_sources without migrating the configured identifier and query path.
  const id = encodeURIComponent(config.NOTION_DATABASE_ID);
  const database = (await read('databases/' + id)) as {
    properties: Record<string, NotionProperty>;
  };
  const page = (await read('databases/' + id + '/query', {
    page_size: 50,
    sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
    ...(cursor ? { start_cursor: cursor } : {}),
  })) as {
    results: NotionPage[];
    has_more: boolean;
    next_cursor: string | null;
  };
  return {
    checkedAt: new Date().toISOString(),
    connection: 'read_verified',
    properties: Object.entries(database.properties).map(([name, property]) => ({
      name,
      type: property.type,
    })),
    items: page.results.map((row) => ({
      id: row.id,
      url: row.url,
      updatedAt: row.last_edited_time,
      title:
        Object.values(row.properties)
          .find((p) => p.type === 'title')
          ?.title?.map((t) => t.plain_text || '')
          .join('') || 'Sin título',
      sources:
        row.properties['Source Tags']?.multi_select?.map((t) => t.name) || [],
      channels: row.properties.Channels?.multi_select?.map((t) => t.name) || [],
      status: row.properties.Status?.status?.name || null,
      providerStatuses: Object.entries(row.properties)
        .filter(
          ([name, value]) =>
            name !== 'Status' &&
            value.type === 'status' &&
            name.toLowerCase().includes('status'),
        )
        .map(([name, value]) => ({
          provider: name.replace(/ status/i, ''),
          status: value.status?.name || '',
        }))
        .filter(
          (item) =>
            item.status &&
            (row.properties['Source Tags']?.multi_select || []).some((source) =>
              item.provider.toLowerCase().includes(source.name.toLowerCase()),
            ),
        ),
      diagnostic:
        row.properties['Postly Error']?.rich_text
          ?.map((t) => t.plain_text || '')
          .join('') || '',
    })),
    nextCursor: page.has_more ? page.next_cursor : null,
  };
}

function notionReader(token: string) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };
  async function read(path: string, query?: object) {
    let response: Response;
    try {
      response = await fetch('https://api.notion.com/v1/' + path, {
        method: query ? 'POST' : 'GET',
        headers,
        ...(query ? { body: JSON.stringify(query) } : {}),
        signal: AbortSignal.timeout(20000),
        redirect: 'manual',
      });
    } catch {
      throw new ApiError(
        502,
        'notion_unreachable',
        'No se pudo contactar con Notion. Inténtalo de nuevo.',
      );
    }
    if (!response.ok) {
      if (response.status === 429)
        throw new ApiError(
          429,
          'notion_rate_limited',
          'Notion pide esperar antes de volver a consultar.',
        );
      throw new ApiError(
        502,
        'notion_read_failed',
        `Notion rechazó la lectura (HTTP ${response.status}). Revisa los permisos de la integración.`,
      );
    }
    return response.json();
  }
  return read;
}

export async function readNotionPage(pageId: string): Promise<NotionPage> {
  const config = env as unknown as {
    NOTION_TOKEN?: string;
    NOTION_DATABASE_ID?: string;
  };
  if (!config.NOTION_TOKEN || !config.NOTION_DATABASE_ID)
    throw new ApiError(
      503,
      'notion_not_configured',
      'Notion no está configurado.',
    );
  const row = (await notionReader(config.NOTION_TOKEN)(
    'pages/' + encodeURIComponent(pageId),
  )) as NotionPage;
  if (
    row.archived ||
    row.in_trash ||
    row.parent?.database_id?.replaceAll('-', '') !==
      config.NOTION_DATABASE_ID.replaceAll('-', '')
  )
    throw new ApiError(
      404,
      'notion_page_unavailable',
      'El registro no pertenece al CMS activo o está archivado.',
    );
  return row;
}
