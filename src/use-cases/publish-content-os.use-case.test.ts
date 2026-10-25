import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONTENT_OS_PUBLISH_LIVE_ENV } from '../config/schema';
import { NotionPage, NotionTransport } from '../readers/notion-transport';
import { executePublishContentOsUseCase } from './publish-content-os.use-case';

function page(id: string, properties: Record<string, any>): NotionPage {
  return { id, properties };
}

function memoryTransport(pages: Record<string, NotionPage>, queryResults: NotionPage[] = []) {
  const updates: Array<{ id: string; properties: Record<string, unknown> }> = [];
  const transport: NotionTransport & { updates: typeof updates } = {
    updates,
    async getPage(id) {
      const found = pages[id];
      if (!found) throw new Error(`missing page ${id}`);
      return found;
    },
    async queryAll() {
      return queryResults;
    },
    async createPage() {
      return { id: 'created' };
    },
    async updatePage(id, properties) {
      updates.push({ id, properties });
    },
  };
  return transport;
}

const pieza = page('pieza-1', {
  Nombre: { title: [{ plain_text: 'Clip' }] },
  Status: { status: { name: 'Lista' } },
  'Caption base': { rich_text: [{ plain_text: 'caption' }] },
});

const cuentaActiva = page('cuenta-1', {
  Cuenta: { title: [{ plain_text: 'IG' }] },
  Estado: { select: { name: 'Activa' } },
  Conector: { select: { name: 'Postly' } },
  '📡 Canal': { relation: [{ id: 'canal-1' }] },
});

const canalDry = page('canal-1', {
  Nombre: { title: [{ plain_text: 'Instagram' }] },
  Conector: { select: { name: 'Postly' } },
  'Estado del conector': { select: { name: 'dry-run' } },
  Familia: { select: { name: 'Social' } },
});

function pendingPub(overrides: Record<string, any> = {}) {
  return page('pub-1', {
    Título: { title: [{ plain_text: 'Clip · IG' }] },
    Status: { status: { name: 'Pendiente' } },
    Modo: { select: { name: '' } },
    '🧩 Pieza': { relation: [{ id: 'pieza-1' }] },
    '🪪 Cuenta': { relation: [{ id: 'cuenta-1' }] },
    ...overrides,
  });
}

test('empty Modo stays dry-run and never writes Publicado el', async () => {
  const pub = pendingPub();
  const transport = memoryTransport(
    { 'pieza-1': pieza, 'cuenta-1': cuentaActiva, 'canal-1': canalDry, 'pub-1': pub },
    [pub]
  );
  const result = await executePublishContentOsUseCase('pieza-1', {
    transport,
    publishImpl: async (_id, _props, _cuenta, dryRun) => ({
      dry_run: dryRun,
      payload: { kind: 'mock' },
    }),
  });
  assert.equal(result.results[0].dry_run, true);
  assert.equal(result.results[0].reason, 'global_flag_off');
  const statusWrite = transport.updates.find(u => u.properties.Status);
  assert.deepEqual(statusWrite?.properties.Status, { status: { name: 'Dry-run OK' } });
  assert.equal(
    transport.updates.some(u => Object.prototype.hasOwnProperty.call(u.properties, 'Publicado el')),
    false
  );
});

test('Pausada cuenta is skipped before any connector call', async () => {
  const pub = pendingPub();
  const paused = page('cuenta-1', {
    Cuenta: { title: [{ plain_text: 'IG' }] },
    Estado: { select: { name: 'Pausada' } },
    Conector: { select: { name: 'Postly' } },
    '📡 Canal': { relation: [{ id: 'canal-1' }] },
  });
  const transport = memoryTransport(
    { 'pieza-1': pieza, 'cuenta-1': paused, 'canal-1': canalDry, 'pub-1': pub },
    [pub]
  );
  let called = 0;
  const result = await executePublishContentOsUseCase('pieza-1', {
    transport,
    publishImpl: async () => {
      called += 1;
      return { dry_run: true, payload: {} };
    },
  });
  assert.equal(called, 0);
  assert.equal(result.results[0].skipped, 'Only Activa cuentas can publish');
});

test('Clave de idempotencia skips an already published twin', async () => {
  const pub = pendingPub({
    'Clave de idempotencia': { rich_text: [{ plain_text: 'publisher:old:ig' }] },
  });
  const twin = page('pub-twin', {
    Título: { title: [{ plain_text: 'twin' }] },
    Status: { status: { name: 'Publicado' } },
    'Publicado el': { date: { start: '2026-10-01' } },
    'Clave de idempotencia': { rich_text: [{ plain_text: 'publisher:old:ig' }] },
  });
  const transport = memoryTransport(
    { 'pieza-1': pieza, 'cuenta-1': cuentaActiva, 'canal-1': canalDry, 'pub-1': pub, 'pub-twin': twin },
    [pub]
  );
  transport.queryAll = async (_db, filter: any) => {
    if (filter?.property === 'Clave de idempotencia') return [twin];
    return [pub];
  };
  const result = await executePublishContentOsUseCase('pieza-1', { transport });
  assert.equal(result.results[0].reason, 'idempotent_skip');
});

test('real publish writes Publicado el; dry-run never does', async () => {
  const prev = process.env[CONTENT_OS_PUBLISH_LIVE_ENV];
  process.env[CONTENT_OS_PUBLISH_LIVE_ENV] = 'true';
  const canalLive = page('canal-1', {
    Nombre: { title: [{ plain_text: 'Instagram' }] },
    Conector: { select: { name: 'Postly' } },
    'Estado del conector': { select: { name: 'live' } },
    Familia: { select: { name: 'Social' } },
  });
  const pub = pendingPub({ Modo: { select: { name: 'live' } } });
  const transport = memoryTransport(
    { 'pieza-1': pieza, 'cuenta-1': cuentaActiva, 'canal-1': canalLive, 'pub-1': pub },
    [pub]
  );
  try {
    const result = await executePublishContentOsUseCase('pieza-1', {
      transport,
      publishImpl: async () => ({
        dry_run: false,
        payload: { kind: 'mock' },
        response: { url: 'https://example.test/p/1' },
      }),
    });
    assert.equal(result.results[0].dry_run, false);
    const dated = transport.updates.find(u => u.properties['Publicado el']);
    assert.ok(dated, 'expected Publicado el on live publish');
    assert.deepEqual(dated?.properties.Status, { status: { name: 'Publicado' } });
  } finally {
    if (prev === undefined) delete process.env[CONTENT_OS_PUBLISH_LIVE_ENV];
    else process.env[CONTENT_OS_PUBLISH_LIVE_ENV] = prev;
  }
});
