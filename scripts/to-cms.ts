/**
 * /to-cms live ingest: content package → Publisher page(s), Not started.
 * Never calls publish webhooks.
 *
 * Usage (from notion-publisher root):
 *   npm run to-cms -- --package=/abs/path/package.md
 *   npm run to-cms -- --package=./fixtures/x.md --dry-run
 *   npm run to-cms -- --package=./x.md --sources=Gumroad,Postly
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { env } from '../src/config/env';
import { NOTION_VERSION } from '../src/services/notion.service';
import {
  buildIngestPages,
  type ResolvedIngest,
} from '../src/services/to-cms-ingest';

function arg(name: string): string | undefined {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}
function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function findResolver(): string {
  const home = process.env.HOME || '';
  const candidates = [
    // vault: .../Claude Code/.agents/skills/to-cms (6 up from scripts/)
    path.resolve(
      __dirname,
      '../../../../../../.agents/skills/to-cms/scripts/resolve-channels.mjs'
    ),
    path.resolve(home, '.claude/skills/to-cms/scripts/resolve-channels.mjs'),
    path.resolve(home, '.agents/skills/to-cms/scripts/resolve-channels.mjs'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(
    'resolve-channels.mjs not found. Install to-cms skill (vault .agents/skills/to-cms or ~/.claude/skills/to-cms).'
  );
}

function resolvePackage(packagePath: string): ResolvedIngest {
  const resolver = findResolver();
  const args = [resolver, `--package=${packagePath}`];
  const sources = arg('sources');
  const channels = arg('channels');
  const producer = arg('producer-skill');
  if (sources) args.push(`--sources=${sources}`);
  if (channels) args.push(`--channels=${channels}`);
  if (producer) args.push(`--producer-skill=${producer}`);
  const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
  if (r.status !== 0 && !r.stdout) {
    throw new Error(r.stderr || `resolver exit ${r.status}`);
  }
  const parsed = JSON.parse(r.stdout) as ResolvedIngest;
  if (!parsed.ok) {
    console.error('[to-cms] resolve incomplete:', parsed.missing);
  }
  return parsed;
}

async function notion(method: string, apiPath: string, body?: unknown) {
  const res = await fetch(`https://api.notion.com/v1${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Notion ${method} ${apiPath}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

async function main() {
  const pkg = arg('package');
  if (!pkg) {
    console.error('Usage: npm run to-cms -- --package=<path> [--dry-run] [--sources=...]');
    process.exit(2);
  }
  const packagePath = path.resolve(pkg);
  if (!fs.existsSync(packagePath)) {
    console.error(`Package not found: ${packagePath}`);
    process.exit(2);
  }

  const resolved = resolvePackage(packagePath);
  const payloads = buildIngestPages(resolved);

  console.log(
    JSON.stringify(
      {
        title: resolved.title,
        layers: resolved.layers,
        sources: resolved.sources,
        channels: resolved.channels,
        missing: resolved.missing,
        recommended: resolved.recommended,
        buttons: resolved.buttons,
        pageCount: payloads.length,
      },
      null,
      2
    )
  );

  if (!resolved.ok) process.exit(1);
  if (hasFlag('dry-run') || !hasFlag('live')) {
    console.log('\n[to-cms] dry-run only (pass --live to create Notion pages). Never publishes.');
    console.log(JSON.stringify({ payloads }, null, 2));
    return;
  }

  const databaseId = env.NOTION_DATABASE_ID;
  if (!databaseId) throw new Error('NOTION_DATABASE_ID required');

  const created: { id: string; url: string; layer: string }[] = [];
  for (const p of payloads) {
    const page = await notion('POST', '/pages', {
      parent: { database_id: databaseId },
      properties: p.properties,
    });
    const id = page.id as string;
    const url = (page.url as string) || `https://notion.so/${id.replace(/-/g, '')}`;
    created.push({ id, url, layer: p.layer });
    console.log(`[to-cms] created ${p.layer}: ${url}`);
  }

  console.log('\nPress Notion buttons (do not re-run publish from this script):');
  for (const b of resolved.buttons) console.log(`  - ${b}`);
  if (resolved.recommended.length) {
    console.log('\nRecommended fields still empty:', resolved.recommended.join(', '));
  }
  console.log(JSON.stringify({ created }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
