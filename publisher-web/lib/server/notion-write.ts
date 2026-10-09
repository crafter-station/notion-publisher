import { env } from 'cloudflare:workers';
import { ApiError } from './context';
import type { notionWritePlan } from '../notion-write-plan';

export async function writeNotionProperties(
  pageId: string,
  properties: ReturnType<typeof notionWritePlan>['properties'],
) {
  const token = (env as unknown as { NOTION_TOKEN?: string }).NOTION_TOKEN;
  if (!token)
    throw new ApiError(
      503,
      'notion_not_configured',
      'Notion no está configurado.',
    );
  // Exactly one attempt. A timeout cannot prove that Notion did not apply it.
  const response = await fetch(
    'https://api.notion.com/v1/pages/' + encodeURIComponent(pageId),
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties }),
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok)
    throw new ApiError(
      502,
      'notion_write_rejected',
      `Notion rechazó la escritura (HTTP ${response.status}).`,
    );
  // A successful HTTP response alone is insufficient: the caller rereads the page.
}
