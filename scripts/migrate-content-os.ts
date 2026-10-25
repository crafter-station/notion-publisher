/**
 * Map legacy Publisher rows (or a snapshot JSON) onto Content OS
 * 🧩 Piezas + 🚀 Publicaciones. --dry-run is the default.
 *
 *   npm run migrate-content-os -- --snapshot=./exports/publisher-snapshot-2026-10-25.json
 *   npm run migrate-content-os -- --snapshot=./snap.json --live
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import {
  loadChannelAccountCatalog,
  STATIC_CANALES,
  STATIC_CUENTAS,
} from '../src/catalog/channels';
import { contentOsDatabaseIds } from '../src/config/content-os';
import { env } from '../src/config/env';
import { createHttpNotionTransport } from '../src/readers/notion-transport';
import {
  loadExistingIdempotencyKeys,
  loadPublisherSnapshot,
  migrateContentOs,
} from '../src/services/migrate-content-os';

function arg(name: string): string | undefined {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}
function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const snapshotPath = arg('snapshot');
  if (!snapshotPath) {
    console.error(
      'Usage: npm run migrate-content-os -- --snapshot=<json> [--dry-run|--live]'
    );
    process.exit(2);
  }
  const abs = path.resolve(snapshotPath);
  if (!fs.existsSync(abs)) {
    console.error(`Snapshot not found: ${abs}`);
    process.exit(2);
  }

  const rows = loadPublisherSnapshot(JSON.parse(fs.readFileSync(abs, 'utf8')));
  const dryRun = !hasFlag('live');
  const ids = contentOsDatabaseIds();
  const transport = createHttpNotionTransport(env.NOTION_TOKEN);
  const catalog = await loadChannelAccountCatalog(transport, {
    canales: ids.canales,
    cuentas: ids.cuentas,
  }).catch(() => ({
    source: 'static' as const,
    canales: STATIC_CANALES,
    cuentas: STATIC_CUENTAS,
  }));

  let existingKeys: Set<string> | undefined;
  if (!dryRun) {
    existingKeys = await loadExistingIdempotencyKeys(transport, ids.publicaciones);
  }

  const report = await migrateContentOs({
    rows,
    catalog,
    transport,
    ids,
    dryRun,
    existingKeys,
  });

  console.log(JSON.stringify({ snapshot: abs, catalog_source: catalog.source, report }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
