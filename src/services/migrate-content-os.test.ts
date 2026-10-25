import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STATIC_CANALES, STATIC_CUENTAS } from '../catalog/channels';
import { NotionTransport } from '../readers/notion-transport';
import {
  inferTargets,
  loadPublisherSnapshot,
  matchCuentas,
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

test('migrate passes through optional Pieza design fields and Image (versión)', async () => {
  const created: Array<{ db: string; props: Record<string, unknown> }> = [];
  const transport: NotionTransport = {
    async getPage(id) {
      return { id };
    },
    async queryAll() {
      return [];
    },
    async createPage(db, properties) {
      created.push({ db, props: properties });
      return { id: `new-${created.length}` };
    },
    async updatePage() {},
  };
  const postly = STATIC_CUENTAS.filter(c => c.conector === 'Postly' && c.estado === 'Activa');
  await migrateContentOs({
    rows: [
      {
        id: 'legacy-design',
        title: 'Designed row',
        sources: ['Postly'],
        fields: {
          Módulo: 'Content',
          Formato: 'post',
          Slides: 2,
          'Image (versión)': 'https://cdn.example/ver.png',
        },
      },
    ],
    catalog: { source: 'static', canales: STATIC_CANALES, cuentas: postly.slice(0, 1) },
    transport,
    ids: { piezas: 'piezas', publicaciones: 'pubs' },
    dryRun: false,
  });
  const pieza = created.find(c => c.db === 'piezas');
  const pub = created.find(c => c.db === 'pubs');
  assert.ok(pieza);
  assert.ok(pub);
  assert.deepEqual((pieza.props['Módulo'] as any).select, { name: 'Content' });
  assert.deepEqual((pieza.props.Formato as any).select, { name: 'post' });
  assert.equal((pieza.props.Slides as any).number, 2);
  assert.equal((pub.props['Image (versión)'] as any).files[0].external.url, 'https://cdn.example/ver.png');
});

test('migrate is idempotent via Clave de idempotencia keys', async () => {
  const row = { id: 'legacy-1', title: 'Old row', sources: ['Postly'] };
  const catalog = { source: 'static' as const, canales: STATIC_CANALES, cuentas: STATIC_CUENTAS };
  const target = inferTargets(row, catalog).targets[0];
  const cuenta = matchCuentas(catalog, target)[0];
  const existing = new Set<string>([piezaKey(row), publicacionKey(row, `${target.hint}:${cuenta.id}`)]);
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
