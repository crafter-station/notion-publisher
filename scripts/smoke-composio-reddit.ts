/**
 * Smoke Composio Reddit: discover accounts, create/update page, publish self + link.
 * Requires COMPOSIO_API_KEY (+ preferably USER_ID / CONNECTED_ACCOUNT_ID after first discover).
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/smoke-composio-reddit.ts
 *   npx ts-node --transpile-only scripts/smoke-composio-reddit.ts --page=<notion_page_id>
 */
import 'dotenv/config';
import { env } from '../src/config/env';
import {
  ComposioService,
  isComposioConfigured,
} from '../src/services/composio.service';
import { NOTION_VERSION, updateComposioRedditMetadata } from '../src/services/notion.service';
import { executePublishComposioUseCase } from '../src/use-cases/publish-composio.use-case';

const token = env.NOTION_TOKEN;
const databaseId = env.NOTION_DATABASE_ID;

function arg(name: string): string | undefined {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

async function notion(method: string, path: string, body?: unknown) {
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

async function ensureSmokePage(existingId?: string): Promise<string> {
  const stamp = new Date().toISOString().slice(0, 19);
  const properties: any = {
    Name: { title: [{ text: { content: `Composio Reddit smoke ${stamp}` } }] },
    'Source Tags': { multi_select: [{ name: 'Composio' }] },
    Channels: { multi_select: [{ name: 'Reddit' }] },
    'Reddit Title': {
      rich_text: [{ text: { content: `Publisher smoke ${stamp}` } }],
    },
    'Reddit Body': {
      rich_text: [
        {
          text: {
            content:
              'Automated smoke from notion-publisher Composio path (self post). Safe to ignore/delete.',
          },
        },
      ],
    },
    'Reddit Subreddit': {
      rich_text: [{ text: { content: env.COMPOSIO_REDDIT_SUBREDDIT || 'test' } }],
    },
    'Reddit Link URL': { url: 'https://github.com/Nucleo-Lab/notion-publisher' },
  };
  if (env.COMPOSIO_USER_ID) {
    properties['Composio User ID'] = {
      rich_text: [{ text: { content: env.COMPOSIO_USER_ID } }],
    };
  }
  if (env.COMPOSIO_CONNECTED_ACCOUNT_ID) {
    properties['Composio Connected Account ID'] = {
      rich_text: [{ text: { content: env.COMPOSIO_CONNECTED_ACCOUNT_ID } }],
    };
  }

  if (existingId) {
    await notion('PATCH', `/pages/${existingId}`, { properties });
    return existingId;
  }
  if (!databaseId) throw new Error('NOTION_DATABASE_ID required');
  const page = await notion('POST', '/pages', {
    parent: { database_id: databaseId },
    properties,
  });
  return page.id as string;
}

async function main() {
  if (!isComposioConfigured()) {
    console.error(
      'COMPOSIO_API_KEY missing. Add rotated key to .env then re-run.\n' +
        'Also set COMPOSIO_USER_ID + COMPOSIO_CONNECTED_ACCOUNT_ID from GET /capabilities/composio'
    );
    process.exit(2);
  }

  const composio = new ComposioService();
  const redditAccounts = await composio.listConnectedAccounts({ toolkit: 'reddit' });
  console.log(
    '[discover] reddit accounts:',
    redditAccounts.map(a => ({ id: a.id, user_id: a.user_id, status: a.status }))
  );

  if (!env.COMPOSIO_USER_ID && redditAccounts[0]?.user_id) {
    console.log(
      `[hint] export COMPOSIO_USER_ID=${redditAccounts[0].user_id} (or set in .env)`
    );
  }
  if (!env.COMPOSIO_CONNECTED_ACCOUNT_ID && redditAccounts[0]?.id) {
    console.log(
      `[hint] export COMPOSIO_CONNECTED_ACCOUNT_ID=${redditAccounts[0].id}`
    );
  }

  // Prefer env; else first account for this smoke process only
  if (!env.COMPOSIO_USER_ID && redditAccounts[0]?.user_id) {
    process.env.COMPOSIO_USER_ID = redditAccounts[0].user_id;
    (env as any).COMPOSIO_USER_ID = redditAccounts[0].user_id;
  }
  if (!env.COMPOSIO_CONNECTED_ACCOUNT_ID && redditAccounts[0]?.id) {
    process.env.COMPOSIO_CONNECTED_ACCOUNT_ID = redditAccounts[0].id;
    (env as any).COMPOSIO_CONNECTED_ACCOUNT_ID = redditAccounts[0].id;
  }

  const pageId = await ensureSmokePage(arg('page'));
  console.log('[page]', pageId);

  await updateComposioRedditMetadata(pageId, { composio_status: 'Not started' });

  console.log('[publish] kind=self …');
  await executePublishComposioUseCase(pageId, { kind: 'self' });

  // brief pause to avoid Reddit RATELIMIT
  await new Promise(r => setTimeout(r, 3000));

  // refresh link fields then link post (new title to avoid exact dup)
  const stamp2 = Date.now();
  await notion('PATCH', `/pages/${pageId}`, {
    properties: {
      'Reddit Title': {
        rich_text: [{ text: { content: `Publisher smoke link ${stamp2}` } }],
      },
      'Reddit Link URL': { url: 'https://github.com/Nucleo-Lab/notion-publisher' },
      'Composio Publish Status': { status: { name: 'Not started' } },
    },
  });

  console.log('[publish] kind=link …');
  await executePublishComposioUseCase(pageId, { kind: 'link' });

  console.log('[done] check Notion Reddit URL / Composio Publish Status on', pageId);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
