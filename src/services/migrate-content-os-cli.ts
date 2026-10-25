/**
 * CLI for migrate-content-os. Does not import src/config/env.ts.
 * Dry-run (default) works with an empty environment.
 */

import * as fs from 'fs';
import * as path from 'path';
import { STATIC_CANALES, STATIC_CUENTAS } from '../catalog/channels';
import { contentOsDatabaseIds } from '../config/content-os';
import { createOfflineNotionTransport } from '../readers/notion-transport';
import {
  loadPublisherSnapshot,
  migrateContentOs,
  type MigrationReport,
} from './migrate-content-os';

export type MigrateCliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  payload?: {
    snapshot: string;
    offline: boolean;
    catalog_source: 'static' | 'notion';
    report: MigrationReport;
  };
};

function arg(argv: string[], name: string): string | undefined {
  const hit = argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(`--${name}`);
}

export function notionTokenFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  return (env.NOTION_TOKEN || '').trim();
}

export function shouldRunOffline(argv: string[], env: NodeJS.ProcessEnv = process.env): boolean {
  if (hasFlag(argv, 'offline')) return true;
  const live = hasFlag(argv, 'live');
  return !live && !notionTokenFromEnv(env);
}

export async function runMigrateContentOsCli(
  argv: string[] = process.argv,
  options: { env?: NodeJS.ProcessEnv; cwd?: string } = {}
): Promise<MigrateCliResult> {
  const env = options.env || process.env;
  const cwd = options.cwd || process.cwd();
  const logs: string[] = [];
  const errs: string[] = [];
  const log = (line: string) => logs.push(line);
  const error = (line: string) => errs.push(line);

  const snapshotPath = arg(argv, 'snapshot');
  if (!snapshotPath) {
    error('Usage: npm run migrate-content-os -- --snapshot=<json> [--offline|--dry-run|--live]');
    error('Dry-run (default) needs no env. A real run (--live) needs NOTION_TOKEN.');
    return { exitCode: 2, stdout: logs.join('\n'), stderr: errs.join('\n') };
  }

  const live = hasFlag(argv, 'live');
  const offlineFlag = hasFlag(argv, 'offline');
  if (live && offlineFlag) {
    error('Cannot combine --live and --offline.');
    return { exitCode: 2, stdout: logs.join('\n'), stderr: errs.join('\n') };
  }

  const abs = path.resolve(cwd, snapshotPath);
  if (!fs.existsSync(abs)) {
    error(`Snapshot not found: ${abs}`);
    return { exitCode: 2, stdout: logs.join('\n'), stderr: errs.join('\n') };
  }

  const dryRun = !live;
  const offline = shouldRunOffline(argv, env);

  let rows;
  try {
    rows = loadPublisherSnapshot(JSON.parse(fs.readFileSync(abs, 'utf8')));
  } catch (err: any) {
    error(err?.message || String(err));
    return { exitCode: 1, stdout: logs.join('\n'), stderr: errs.join('\n') };
  }

  if (live) {
    const token = notionTokenFromEnv(env);
    if (!token) {
      error(
        'A real (non dry-run) migrate needs NOTION_TOKEN. Dry-run needs no env: npm run migrate-content-os -- --snapshot=<json>'
      );
      return { exitCode: 1, stdout: logs.join('\n'), stderr: errs.join('\n') };
    }

    const { createHttpNotionTransport } = await import('../readers/notion-transport');
    const { loadChannelAccountCatalog } = await import('../catalog/channels');
    const { loadExistingIdempotencyKeys } = await import('./migrate-content-os');
    const ids = contentOsDatabaseIds();
    const transport = createHttpNotionTransport(token);
    const catalog = await loadChannelAccountCatalog(transport, {
      canales: ids.canales,
      cuentas: ids.cuentas,
    });
    const existingKeys = await loadExistingIdempotencyKeys(transport, ids.publicaciones);
    const report = await migrateContentOs({
      rows,
      catalog,
      transport,
      ids,
      dryRun: false,
      existingKeys,
    });
    const payload = {
      snapshot: abs,
      offline: false,
      catalog_source: catalog.source,
      report,
    } as const;
    log(JSON.stringify(payload, null, 2));
    return { exitCode: 0, stdout: logs.join('\n'), stderr: errs.join('\n'), payload };
  }

  const report = await migrateContentOs({
    rows,
    catalog: { source: 'static', canales: STATIC_CANALES, cuentas: STATIC_CUENTAS },
    transport: createOfflineNotionTransport(),
    ids: { piezas: 'offline-piezas', publicaciones: 'offline-publicaciones' },
    dryRun,
  });
  const payload = {
    snapshot: abs,
    offline,
    catalog_source: 'static' as const,
    report,
  };
  log(JSON.stringify(payload, null, 2));
  return { exitCode: 0, stdout: logs.join('\n'), stderr: errs.join('\n'), payload };
}

export async function main(argv: string[] = process.argv): Promise<number> {
  const result = await runMigrateContentOsCli(argv);
  if (result.stdout) console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);
  return result.exitCode;
}
