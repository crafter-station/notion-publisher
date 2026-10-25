import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'node:test';
import { parseExcludeRefs, runMigrateContentOsCli, shouldRunOffline } from './migrate-content-os-cli';

const SAMPLE = {
  pages: [
    { id: 'row-1', title: 'Hello clip', sources: ['Postly'] },
    { id: 'row-2', title: 'Second clip', sources: ['Postly'] },
    { title: 'missing-id', sources: ['Postly'] },
  ],
};

function writeSnapshot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-os-'));
  const file = path.join(dir, 'snapshot.json');
  fs.writeFileSync(file, JSON.stringify(SAMPLE));
  return file;
}

const EMPTY_ENV: NodeJS.ProcessEnv = {
  PATH: process.env.PATH,
  HOME: process.env.HOME || os.tmpdir(),
};

test('dry-run without NOTION_TOKEN is offline', () => {
  assert.equal(shouldRunOffline(['node', 'migrate'], {}), true);
  assert.equal(shouldRunOffline(['node', 'migrate', '--offline'], { NOTION_TOKEN: 'ntn_x' }), true);
  assert.equal(shouldRunOffline(['node', 'migrate', '--live'], {}), false);
});

test('imported CLI dry-run works with an empty env and prints a report', async () => {
  const snapshot = writeSnapshot();
  const result = await runMigrateContentOsCli(
    ['node', 'migrate-content-os', `--snapshot=${snapshot}`, '--offline'],
    { env: {} }
  );
  assert.equal(result.exitCode, 0, result.stderr);
  assert.ok(result.payload);
  assert.equal(result.payload.offline, true);
  assert.equal(result.payload.catalog_source, 'static');
  assert.equal(result.payload.report.dry_run, true);
  assert.equal(result.payload.report.source_rows, 3);
  assert.ok(result.payload.report.errors.length >= 1);
  assert.ok(result.payload.report.piezas.would_create >= 1);
  assert.ok(result.payload.report.publicaciones.would_create >= 1);
  assert.match(result.stdout, /"would_create"/);
  assert.match(result.stdout, /"skipped_existing"/);
});

test('spawned migrate-content-os dry-run exits 0 with empty env', () => {
  const snapshot = writeSnapshot();
  const root = process.cwd();
  const child = spawnSync(
    process.execPath,
    [
      '--require',
      require.resolve('ts-node/register/transpile-only'),
      path.join(root, 'scripts/migrate-content-os.ts'),
      `--snapshot=${snapshot}`,
    ],
    {
      encoding: 'utf8',
      cwd: root,
      env: EMPTY_ENV,
    }
  );
  assert.equal(child.status, 0, child.stderr || child.stdout);
  const payload = JSON.parse(child.stdout);
  assert.equal(payload.offline, true);
  assert.equal(payload.report.dry_run, true);
  assert.ok(payload.report.piezas.would_create >= 1);
  assert.ok(payload.report.publicaciones.would_create >= 1);
  assert.ok(payload.report.errors.length >= 1);
  assert.ok(Array.isArray(payload.report.missing_cuentas));
});

test('parseExcludeRefs accepts a comma list or a file of ids/urls', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exclude-'));
  const file = path.join(dir, 'exclude.txt');
  fs.writeFileSync(file, 'prod-1\n# comment\nhttps://www.notion.so/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee\n');
  assert.deepEqual(parseExcludeRefs('prod-1, prod-2', dir), ['prod-1', 'prod-2']);
  assert.deepEqual(parseExcludeRefs(file, dir), [
    'prod-1',
    'https://www.notion.so/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  ]);
  assert.deepEqual(parseExcludeRefs(undefined, dir), []);
});

test('CLI --exclude-ids skips listed rows and reports excluded', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-os-'));
  const snapshot = path.join(dir, 'snapshot.json');
  fs.writeFileSync(
    snapshot,
    JSON.stringify({
      pages: [
        { id: 'row-keep', title: 'Keep', sources: ['Postly'] },
        { id: 'row-skip', title: 'Skip', sources: ['Postly'] },
        { id: 'row-arch', title: 'Archived', sources: ['Postly'], status: 'Archived' },
      ],
    })
  );
  const result = await runMigrateContentOsCli(
    ['node', 'migrate-content-os', `--snapshot=${snapshot}`, '--offline', '--exclude-ids=row-skip'],
    { env: {} }
  );
  assert.equal(result.exitCode, 0, result.stderr);
  assert.ok(result.payload);
  assert.equal(result.payload.report.excluded.by_id, 1);
  assert.equal(result.payload.report.excluded.archived, 1);
  assert.equal(result.payload.report.excluded.total, 2);
  assert.equal(result.payload.report.piezas.would_create, 1);
  assert.match(result.stdout, /"excluded"/);
});

test('--live without NOTION_TOKEN fails with a clear message', async () => {
  const snapshot = writeSnapshot();
  const result = await runMigrateContentOsCli(
    ['node', 'migrate-content-os', `--snapshot=${snapshot}`, '--live'],
    { env: {} }
  );
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /NOTION_TOKEN/);
  assert.match(result.stderr, /Dry-run needs no env/);
});
