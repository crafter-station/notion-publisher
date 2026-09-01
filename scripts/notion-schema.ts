/**
 * Read-only Publisher schema dump (no secrets; DB id suffix only).
 *
 * Prefer this CLI when Notion MCP is not auth'd in the current agent session.
 * Uses Notion-Version 2022-06-28 (same as runtime services) so `properties` stay on the database resource.
 *
 * Usage:
 *   npm run notion:schema
 *   npm run notion:schema -- --json
 *   npm run notion:schema -- --filter=Gumroad
 */
import 'dotenv/config';

const NOTION_VERSION = process.env.NOTION_VERSION || '2022-06-28';
const token = process.env.NOTION_TOKEN;
const databaseId = process.env.NOTION_DATABASE_ID;

if (!token || !databaseId) {
  console.error('Need NOTION_TOKEN + NOTION_DATABASE_ID in .env');
  process.exit(1);
}

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const filterArg = args.find((a) => a.startsWith('--filter='));
const filter = filterArg ? filterArg.slice('--filter='.length).toLowerCase() : '';

type Prop = {
  type: string;
  select?: { options?: { name: string }[] };
  multi_select?: { options?: { name: string }[] };
  status?: { options?: { name: string }[] };
};

function optionNames(p: Prop): string[] {
  const bag = p.select || p.multi_select || p.status;
  return (bag?.options || []).map((o) => o.name);
}

async function main() {
  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
    },
  });
  if (!res.ok) {
    console.error(await res.text());
    process.exit(1);
  }

  const db = (await res.json()) as {
    id: string;
    title?: { plain_text?: string }[];
    properties: Record<string, Prop>;
  };

  const title = (db.title || []).map((t) => t.plain_text || '').join('') || '(untitled)';
  const suffix = db.id.replace(/-/g, '').slice(-8);
  const rows = Object.entries(db.properties)
    .filter(([name]) => !filter || name.toLowerCase().includes(filter))
    .map(([name, p]) => ({
      name,
      type: p.type,
      options: optionNames(p),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          title,
          id_suffix: suffix,
          notion_version: NOTION_VERSION,
          property_count: rows.length,
          properties: rows,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`Publisher schema · ${title} · …${suffix} · ${rows.length} props · API ${NOTION_VERSION}`);
  console.log('(read-only · no secrets · use Notion MCP in Cursor/Claude for interactive browse)\n');
  for (const r of rows) {
    const opts = r.options.length ? ` · [${r.options.slice(0, 8).join(', ')}${r.options.length > 8 ? ', …' : ''}]` : '';
    console.log(`${r.name}\t${r.type}${opts}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
