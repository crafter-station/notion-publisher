import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STATIC_CANALES, STATIC_CUENTAS } from '../catalog/channels';
import { NotionTransport } from '../readers/notion-transport';
import {
  isArchivedRow,
  loadExistingPiezaKeys,
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
      throw new Error('should not create excluded rows');
    },
    async updatePage() {},
  };
}

test('isArchivedRow treats Status / archived / in_trash as archived', () => {
  assert.equal(isArchivedRow({ id: 'a', status: 'Archived' }), true);
  assert.equal(isArchivedRow({ id: 'b', status: 'archivado' }), true);
  assert.equal(isArchivedRow({ id: 'c', archived: true }), true);
  assert.equal(isArchivedRow({ id: 'd', inTrash: true }), true);
  assert.equal(isArchivedRow(loadPublisherSnapshot([{ page_id: 'e', Status: 'archived' }])[0]), true);
  assert.equal(isArchivedRow(loadPublisherSnapshot([{ page_id: 'f', archived: true }])[0]), true);
  assert.equal(isArchivedRow(loadPublisherSnapshot([{ page_id: 'g', in_trash: 'yes' }])[0]), true);
  assert.equal(isArchivedRow({ id: 'h', title: 'live', sources: ['Postly'] }), false);
});

test('migrate skips archived rows and reports excluded.archived', async () => {
  const rows = loadPublisherSnapshot([
    { page_id: 'keep-1', Name: 'Keep', Layer: 'Products' },
    { page_id: 'arch-1', Name: 'Old', Layer: 'Products', Status: 'Archived' },
    { page_id: 'trash-1', Name: 'Trash', Layer: 'Social', Channels: 'Instagram', archived: true },
  ]);
  const report = await migrateContentOs({
    rows,
    catalog: STATIC,
    transport: fakeTransport(),
    ids: { piezas: 'piezas', publicaciones: 'pubs' },
    dryRun: true,
    offline: true,
  });
  assert.equal(report.status, 'ok');
  assert.equal(report.source_rows, 3);
  assert.equal(report.processed_rows, 1);
  assert.equal(report.excluded.archived, 2);
  assert.equal(report.excluded.by_id, 0);
  assert.equal(report.excluded.by_url, 0);
  assert.equal(report.excluded.total, 2);
  assert.equal(report.piezas.would_create, 1);
  assert.equal(report.publicaciones.would_create, 1);
});

test('migrate --exclude-ids and --exclude-urls skip matching rows', async () => {
  const dashed = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const rows = loadPublisherSnapshot([
    { page_id: 'keep-2', Name: 'Keep', Layer: 'Products' },
    { page_id: dashed, Name: 'By id', Layer: 'Products' },
    {
      page_id: 'url-1',
      Name: 'By url',
      Layer: 'Products',
      url: 'https://www.notion.so/Workspace-ffffffffffffffffffffffffffffffff',
    },
    { page_id: 'keep-3', Name: 'Also keep', Layer: 'Events' },
  ]);
  const report = await migrateContentOs({
    rows,
    catalog: STATIC,
    transport: fakeTransport(),
    ids: { piezas: 'piezas', publicaciones: 'pubs' },
    dryRun: true,
    offline: true,
    excludeIds: [dashed, 'https://notion.so/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'],
    excludeUrls: ['https://www.notion.so/Workspace-ffffffffffffffffffffffffffffffff'],
  });
  assert.equal(report.excluded.by_id, 1);
  assert.equal(report.excluded.by_url, 1);
  assert.equal(report.excluded.archived, 0);
  assert.equal(report.excluded.total, 2);
  assert.equal(report.piezas.would_create, 2);
  assert.equal(report.source_rows, 4);
  assert.equal(report.processed_rows, 2);
});

test('loadExistingPiezaKeys reads Clave de idempotencia from Piezas', async () => {
  const transport: NotionTransport = {
    async getPage(id) {
      return { id };
    },
    async queryAll() {
      return [
        {
          id: 'pieza-1',
          properties: {
            'Clave de idempotencia': { rich_text: [{ plain_text: 'publisher:legacy-1' }] },
          },
        },
        { id: 'pieza-2', properties: {} },
      ];
    },
    async createPage() {
      return { id: 'new' };
    },
    async updatePage() {},
  };
  const keys = await loadExistingPiezaKeys(transport, 'piezas');
  assert.deepEqual([...keys], ['publisher:legacy-1']);
});
