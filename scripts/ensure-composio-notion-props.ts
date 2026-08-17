/**
 * Ensure Publisher DB has Composio Reddit props (idempotent).
 * Usage: npx ts-node --transpile-only scripts/ensure-composio-notion-props.ts
 */
import 'dotenv/config';

const NOTION_VERSION = '2022-06-28';
const token = process.env.NOTION_TOKEN!;
const databaseId = process.env.NOTION_DATABASE_ID!;

if (!token || !databaseId) {
  console.error('Need NOTION_TOKEN + NOTION_DATABASE_ID');
  process.exit(1);
}

type PropDef =
  | { rich_text: {} }
  | { url: {} }
  | { status: { options: { name: string; color?: string }[] } };

const WANTED: Record<string, PropDef> = {
  'Reddit Subreddit': { rich_text: {} },
  'Reddit Link URL': { url: {} },
  'Composio User ID': { rich_text: {} },
  'Composio Connected Account ID': { rich_text: {} },
  'Reddit URL': { url: {} },
  'Composio URL': { url: {} },
  'Composio Publish Status': {
    status: {
      options: [
        { name: 'Not started', color: 'default' },
        { name: 'In progress', color: 'blue' },
        { name: 'Failed', color: 'red' },
        { name: 'Published', color: 'green' },
      ],
    },
  },
};

async function main() {
  const getRes = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
    },
  });
  if (!getRes.ok) throw new Error(await getRes.text());
  const db = (await getRes.json()) as { properties: Record<string, { type: string }> };
  const existing = db.properties || {};
  const toAdd: Record<string, PropDef> = {};
  for (const [name, def] of Object.entries(WANTED)) {
    if (!existing[name]) toAdd[name] = def;
    else console.log(`ok exists: ${name} (${existing[name].type})`);
  }
  if (Object.keys(toAdd).length === 0) {
    console.log('All Composio/Reddit props already present');
    return;
  }
  const patch = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    },
    body: JSON.stringify({ properties: toAdd }),
  });
  if (!patch.ok) throw new Error(await patch.text());
  console.log('Added props:', Object.keys(toAdd).join(', '));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
