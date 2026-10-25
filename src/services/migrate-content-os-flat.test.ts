import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { STATIC_CANALES, STATIC_CUENTAS } from '../catalog/channels';
import { NotionTransport } from '../readers/notion-transport';
import {
  inferTargets,
  isNumericTitle,
  listSnapshotUnknownColumns,
  loadPublisherSnapshot,
  matchCuentas,
  migrateContentOs,
  piezaKey,
} from './migrate-content-os';

const FIXTURE_PATH = path.join(process.cwd(), 'schema/publisher-snapshot.flat.fixture.json');
const STATIC = { source: 'static' as const, canales: STATIC_CANALES, cuentas: STATIC_CUENTAS };

function fakeTransport(): { transport: NotionTransport; created: string[] } {
  const created: string[] = [];
  const transport: NotionTransport = {
    async getPage(id) {
      return { id };
    },
    async queryAll() {
      return [];
    },
    async createPage(db) {
      created.push(db);
      return { id: `new-${created.length}` };
    },
    async updatePage() {},
  };
  return { transport, created };
}

test('flat snapshot loader reads Name / page_id / Channels and lists unknown columns', () => {
  const raw = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const rows = loadPublisherSnapshot(raw);
  assert.equal(rows.length, 7);
  assert.equal(rows[0].id, 'prod-1');
  assert.equal(rows[0].title, 'Starter kit');
  assert.equal(rows[0].layer, 'Products');
  assert.equal(rows[3].channels?.[0], 'Instagram');
  assert.deepEqual(rows[4].channels, ['x', 'Twitter']);
  const missing = loadPublisherSnapshot([{ Layer: 'Social', Channels: 'Instagram' }]);
  assert.equal(missing[0].id, '');
  assert.equal(missing[0].title, undefined);
  const unknown = listSnapshotUnknownColumns(raw);
  assert.ok(unknown.includes('Extra Widget'));
  assert.ok(!unknown.includes('Name'));
  assert.ok(!unknown.includes('page_id'));
});

test('numeric-only Name becomes the title and is a warning, not a failure', async () => {
  assert.equal(isNumericTitle('21'), true);
  assert.equal(isNumericTitle('Office hours'), false);
  const rows = loadPublisherSnapshot([{ page_id: 'n1', Name: 21, Layer: 'Products' }]);
  assert.equal(rows[0].title, '21');
  const { transport } = fakeTransport();
  const report = await migrateContentOs({
    rows,
    catalog: STATIC,
    transport,
    ids: { piezas: 'piezas', publicaciones: 'pubs' },
    dryRun: true,
    offline: true,
  });
  assert.equal(report.status, 'ok');
  assert.ok(report.warnings.some(w => w.includes('numeric_title') && w.includes('21')));
  assert.equal(report.piezas.would_create, 1);
});

test('Products-layer rows create one Gumroad Publicacion, not every Nativo canal', async () => {
  const raw = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const rows = loadPublisherSnapshot(raw);
  const { transport, created } = fakeTransport();
  const report = await migrateContentOs({
    rows,
    catalog: STATIC,
    transport,
    ids: { piezas: 'piezas', publicaciones: 'pubs' },
    dryRun: true,
    offline: true,
    unknownColumns: listSnapshotUnknownColumns(raw),
  });

  assert.equal(report.status, 'ok');
  assert.equal(report.source_rows, 7);
  assert.equal(report.piezas.would_create, 7);
  assert.equal(report.publicaciones.would_create, 7);
  assert.equal(report.publicaciones.expected, 7);
  assert.equal(report.layers.Products.rows, 3);
  assert.equal(report.layers.Products.publicaciones_expected, 3);
  assert.equal(report.layers.Social.rows, 3);
  assert.equal(report.layers.Social.publicaciones_expected, 3);
  assert.equal(report.layers.Events.rows, 1);
  assert.equal(report.layers.Events.publicaciones_expected, 1);
  assert.equal(created.length, 0);
  assert.ok(report.unknown_columns.includes('Extra Widget'));
  assert.ok(report.warnings.some(w => w.includes('prod-num')));

  const product = rows.find(r => r.id === 'prod-1')!;
  const targets = inferTargets(product, STATIC).targets;
  assert.deepEqual(
    targets.map(t => t.canalNombre),
    ['Gumroad']
  );
  assert.equal(matchCuentas(STATIC, targets[0]).length, 1);
});

test('Events layer infers Luma; unmatched channel names are reported and never become Postly', async () => {
  const events = loadPublisherSnapshot([{ page_id: 'e1', Name: 'Meetup', Layer: 'Events' }]);
  const eventTargets = inferTargets(events[0], STATIC);
  assert.deepEqual(
    eventTargets.targets.map(t => t.canalNombre),
    ['Luma']
  );

  const unknown = loadPublisherSnapshot([
    { page_id: 'u1', Name: 'Mystery', Layer: 'Social', Channels: 'UnknownNet' },
  ]);
  const inferred = inferTargets(unknown[0], STATIC);
  assert.deepEqual(inferred.unmatched, ['UnknownNet']);
  assert.equal(inferred.targets.length, 0);

  const { transport } = fakeTransport();
  const report = await migrateContentOs({
    rows: unknown,
    catalog: STATIC,
    transport,
    ids: { piezas: 'piezas', publicaciones: 'pubs' },
    dryRun: true,
    offline: true,
  });
  assert.equal(report.status, 'error');
  assert.deepEqual(report.unmatched_channels, ['UnknownNet']);
  assert.equal(report.piezas.would_create, 0);
  assert.equal(report.publicaciones.would_create, 0);
  assert.ok(report.errors.some(e => e.includes('UnknownNet')));
});

test('empty Cuentas catalog aborts without creating Piezas', async () => {
  const { transport, created } = fakeTransport();
  const report = await migrateContentOs({
    rows: [{ id: 'x', title: 'Hello', sources: ['Postly'] }],
    catalog: { source: 'notion', canales: STATIC_CANALES, cuentas: [] },
    transport,
    ids: { piezas: 'piezas', publicaciones: 'pubs' },
    dryRun: true,
    offline: true,
  });
  assert.equal(report.status, 'error');
  assert.match(report.errors[0], /Cuentas catalog is empty/);
  assert.equal(report.piezas.would_create, 0);
  assert.equal(created.length, 0);
});

test('live run refuses static-* catalog ids', async () => {
  const { transport, created } = fakeTransport();
  const report = await migrateContentOs({
    rows: [{ id: 'x', title: 'Hello', sources: ['Postly'] }],
    catalog: STATIC,
    transport,
    ids: { piezas: 'piezas', publicaciones: 'pubs' },
    dryRun: false,
    offline: false,
  });
  assert.equal(report.status, 'error');
  assert.match(report.errors[0], /static-\* /);
  assert.equal(report.piezas.created, 0);
  assert.equal(created.length, 0);
});

test('existing publisher:<page_id> key skips the Pieza on a second run', async () => {
  const row = loadPublisherSnapshot([{ page_id: 'prod-1', Name: 'Starter kit', Layer: 'Products' }])[0];
  const { transport, created } = fakeTransport();
  const report = await migrateContentOs({
    rows: [row],
    catalog: STATIC,
    transport,
    ids: { piezas: 'piezas', publicaciones: 'pubs' },
    dryRun: false,
    offline: true,
    existingKeys: new Set([piezaKey(row)]),
  });
  assert.equal(report.piezas.skipped_existing, 1);
  assert.equal(report.piezas.created, 0);
  assert.ok(created.every(db => db !== 'piezas'));
});
