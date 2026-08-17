/**
 * Retry Composio Reddit link publish on an existing smoke page.
 * Usage: npx ts-node --transpile-only scripts/retry-composio-link.ts [--page=<id>]
 */
import 'dotenv/config';
import { env } from '../src/config/env';
import { NOTION_VERSION } from '../src/services/notion.service';
import { executePublishComposioUseCase } from '../src/use-cases/publish-composio.use-case';

const DEFAULT_PAGE = '3beda243-5b46-81e3-90cb-c6c499a4f199';

function arg(name: string): string | undefined {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

async function notion(method: string, path: string, body?: unknown) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Notion ${method} ${path}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

async function main() {
  const pageId = arg('page') || DEFAULT_PAGE;
  const stamp = Date.now();

  await notion('PATCH', `/pages/${pageId}`, {
    properties: {
      'Reddit Title': {
        rich_text: [{ text: { content: `Publisher smoke link retry ${stamp}` } }],
      },
      'Reddit Link URL': { url: 'https://github.com/Nucleo-Lab/notion-publisher' },
      'Composio Publish Status': { status: { name: 'Not started' } },
    },
  });

  console.log('[retry] link on', pageId);
  await executePublishComposioUseCase(pageId, { kind: 'link' });

  const page = await notion('GET', `/pages/${pageId}`);
  const props = page.properties || {};
  console.log(
    '[result] status=',
    props['Composio Publish Status']?.status?.name,
    'url=',
    props['Reddit URL']?.url
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
