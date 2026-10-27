import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STATIC_CANALES, STATIC_CUENTAS } from '../catalog/channels';
import { NotionTransport } from '../readers/notion-transport';
import {
  classifySnapshotColumns,
  listSnapshotUnknownColumns,
  loadPublisherSnapshot,
  migrateContentOs,
} from './migrate-content-os';

const STATIC = { source: 'static' as const, canales: STATIC_CANALES, cuentas: STATIC_CUENTAS };

function fakeTransport(): NotionTransport {
  return {
    async getPage(id) {
      return { id };
    },
    async queryAll() {
      return [];
    },
    async createPage() {
      return { id: 'new' };
    },
    async updatePage() {},
  };
}

const RAW = [
  {
    page_id: 'col-1',
    Name: 'Keep',
    Layer: 'Products',
    page_url: 'https://www.notion.so/Workspace-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'Postly Error': 'old leftover',
    'Eventbrite Event ID': 'evt_123',
    'Extra Widget': 'still-unknown',
  },
];

test('page_url maps to url; Postly Error maps to Error; Eventbrite Event ID is ignored', () => {
  const classified = classifySnapshotColumns(RAW);
  assert.deepEqual(classified.unknown, ['Extra Widget']);
  assert.equal(
    classified.mapped.find(m => m.name === 'Postly Error')?.mapsTo,
    'Error'
  );
  assert.ok(!classified.unknown.includes('page_url'));
  assert.ok(!classified.unknown.includes('Postly Error'));
  assert.ok(!classified.unknown.includes('Eventbrite Event ID'));
  assert.equal(classified.ignored.length, 1);
  assert.equal(classified.ignored[0].name, 'Eventbrite Event ID');
  assert.match(classified.ignored[0].reason, /no matching schema property/);
  assert.deepEqual(listSnapshotUnknownColumns(RAW), ['Extra Widget']);

  const row = loadPublisherSnapshot(RAW)[0];
  assert.equal(row.url, 'https://www.notion.so/Workspace-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
});

test('migrate report lists ignored_columns with reasons and keeps Extra Widget unknown', async () => {
  const classified = classifySnapshotColumns(RAW);
  const report = await migrateContentOs({
    rows: loadPublisherSnapshot(RAW),
    catalog: STATIC,
    transport: fakeTransport(),
    ids: { piezas: 'piezas', publicaciones: 'pubs' },
    dryRun: true,
    offline: true,
    unknownColumns: classified.unknown,
    ignoredColumns: classified.ignored,
  });
  assert.equal(report.source_rows, 1);
  assert.equal(report.processed_rows, 1);
  assert.deepEqual(report.unknown_columns, ['Extra Widget']);
  assert.equal(report.ignored_columns.length, 1);
  assert.equal(report.ignored_columns[0].name, 'Eventbrite Event ID');
  assert.ok(report.ignored_columns[0].reason);
});
