/**
 * Fetch live Notion schemas into docs/schema-snapshot.json.
 * Requires NOTION_TOKEN. Only databases with an id env var are fetched.
 * Writes id suffixes only — never tokens.
 *
 *   npm run schema:snapshot
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { contentOsDatabaseId } from '../src/config/content-os';
import { listSchemaBases } from '../src/config/schema';
import { DEFAULT_SNAPSHOT_PATH, SchemaSnapshot } from '../src/schema/verify';

const NOTION_VERSION = process.env.NOTION_VERSION || '2022-06-28';
const token = process.env.NOTION_TOKEN;

if (!token) {
  console.error('schema:snapshot needs NOTION_TOKEN. No snapshot written.');
  process.exit(1);
}

type NotionProp = { type?: string };

async function fetchDatabase(databaseId: string) {
  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
    },
  });
  if (!res.ok) {
    throw new Error(`GET /databases/${databaseId.slice(-8)} → ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as {
    id: string;
    title?: { plain_text?: string }[];
    properties: Record<string, NotionProp>;
  };
}

async function main() {
  const snapshot: SchemaSnapshot = {
    generated_at: new Date().toISOString(),
    notion_version: NOTION_VERSION,
    bases: {},
  };

  for (const base of listSchemaBases()) {
    const id =
      base.id === 'publisher'
        ? (process.env[base.databaseEnvKey] || '').trim()
        : contentOsDatabaseId(base.id);
    if (!id) {
      console.log(`skip ${base.id} (${base.databaseEnvKey} empty)`);
      continue;
    }
    const db = await fetchDatabase(id);
    snapshot.bases[base.id] = {
      id_suffix: db.id.replace(/-/g, '').slice(-8),
      title: (db.title || []).map(t => t.plain_text || '').join('') || base.displayName,
      properties: Object.entries(db.properties)
        .map(([name, p]) => ({ name, type: p.type || 'unknown' }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
    console.log(
      `fetched ${base.id} …${snapshot.bases[base.id]?.id_suffix} (${snapshot.bases[base.id]?.properties.length} props)`
    );
  }

  const out = path.resolve(__dirname, '..', DEFAULT_SNAPSHOT_PATH);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`wrote ${out}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
