import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STATIC_CANALES, STATIC_CUENTAS } from '../catalog/channels';
import { NotionTransport } from '../readers/notion-transport';
import {
  loadPublisherSnapshot,
  migrateContentOs,
  piezaKey,
  publicacionKey,
} from './migrate-content-os';

test('loadPublisherSnapshot accepts pages/results/rows wrappers', () => {
  const rows = loadPublisherSnapshot({
    pages: [{ id: 'abc', title: 'Hello', sources: ['Postly'] }],
  });
  assert.equal(rows[0].id, 'abc');
  assert.equal(piezaKey(rows[0]), 'publisher:abc');
  assert.match(publicacionKey(rows[0], 'Postly'), /^publisher:abc:Postly/);
});

test('migrate --dry-run counts would_create and never writes', async () => {
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
  const report = await migrateContentOs({
    rows: [{ id: 'legacy-1', title: 'Old row', sources: ['Postly'] }],
    catalog: { source: 'static', canales: STATIC_CANALES, cuentas: STATIC_CUENTAS },
    transport,
    ids: { piezas: 'piezas', publicaciones: 'pubs' },
    dryRun: true,
  });
  assert.equal(report.dry_run, true);
  assert.ok(report.piezas.would_create >= 1);
  assert.ok(report.publicaciones.would_create >= 1);
  assert.equal(created.length, 0);
});

test('migrate is idempotent via Clave de idempotencia keys', async () => {
  const row = { id: 'legacy-1', title: 'Old row', sources: ['Postly'] };
  const existing = new Set<string>([
    piezaKey(row),
    publicacionKey(row, `Postly:${STATIC_CUENTAS.find(c => c.conector === 'Postly')?.id}`),
  ]);
  const transport: NotionTransport = {
    async getPage(id) {
      return { id };
    },
    async queryAll() {
      return [];
    },
    async createPage() {
      throw new Error('should not create');
    },
    async updatePage() {},
  };
  const report = await migrateContentOs({
    rows: [row],
    catalog: { source: 'static', canales: STATIC_CANALES, cuentas: STATIC_CUENTAS },
    transport,
    ids: { piezas: 'piezas', publicaciones: 'pubs' },
    dryRun: false,
    existingKeys: existing,
  });
  assert.equal(report.piezas.skipped_existing, 1);
  assert.ok(report.publicaciones.skipped_existing >= 1);
  assert.equal(report.piezas.created, 0);
  assert.equal(report.publicaciones.created, 0);
});
