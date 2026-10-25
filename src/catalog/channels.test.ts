import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  loadChannelAccountCatalog,
  selectTargetCuentas,
  STATIC_CANALES,
  STATIC_CUENTAS,
} from './channels';
import { NotionTransport } from '../readers/notion-transport';

test('static catalog covers the five Conector values', () => {
  const conectores = new Set(STATIC_CANALES.map(c => c.conector));
  for (const name of ['Postly', 'Postiz', 'Typefully', 'Composio', 'Nativo']) {
    assert.ok(conectores.has(name), `missing ${name}`);
  }
  assert.ok(STATIC_CUENTAS.every(c => c.estado === 'Activa'));
});

test('loadChannelAccountCatalog falls back to static when Notion is empty or fails', async () => {
  const empty: NotionTransport = {
    async getPage(id) {
      return { id };
    },
    async queryAll() {
      return [];
    },
    async createPage() {
      return { id: 'x' };
    },
    async updatePage() {},
  };
  const fromEmpty = await loadChannelAccountCatalog(empty, {
    canales: 'canales',
    cuentas: 'cuentas',
  });
  assert.equal(fromEmpty.source, 'static');
  assert.equal(fromEmpty.canales.length, STATIC_CANALES.length);

  const boom: NotionTransport = {
    ...empty,
    async queryAll() {
      throw new Error('notion down');
    },
  };
  const fromErr = await loadChannelAccountCatalog(boom, {
    canales: 'canales',
    cuentas: 'cuentas',
  });
  assert.equal(fromErr.source, 'static');
});

test('loadChannelAccountCatalog can refuse the static fallback', async () => {
  const empty: NotionTransport = {
    async getPage(id) {
      return { id };
    },
    async queryAll() {
      return [];
    },
    async createPage() {
      return { id: 'x' };
    },
    async updatePage() {},
  };
  const catalog = await loadChannelAccountCatalog(
    empty,
    { canales: 'canales', cuentas: 'cuentas' },
    { allowStaticFallback: false }
  );
  assert.equal(catalog.source, 'notion');
  assert.equal(catalog.cuentas.length, 0);
});

test('loadChannelAccountCatalog reads live dump property names from Notion', async () => {
  const transport: NotionTransport = {
    async getPage(id) {
      return { id };
    },
    async queryAll(db) {
      if (db === 'canales') {
        return [
          {
            id: 'canal-ig',
            properties: {
              Nombre: { title: [{ plain_text: 'Instagram' }] },
              Conector: { select: { name: 'Postly' } },
              'Estado del conector': { select: { name: 'live' } },
              Familia: { select: { name: 'Social' } },
            },
          },
        ];
      }
      return [
        {
          id: 'cuenta-ig',
          properties: {
            Cuenta: { title: [{ plain_text: 'IG nebulabs' }] },
            Estado: { select: { name: 'Activa' } },
            Conector: { select: { name: 'Postly' } },
            '📡 Canal': { relation: [{ id: 'canal-ig' }] },
          },
        },
      ];
    },
    async createPage() {
      return { id: 'x' };
    },
    async updatePage() {},
  };
  const catalog = await loadChannelAccountCatalog(transport, {
    canales: 'canales',
    cuentas: 'cuentas',
  });
  assert.equal(catalog.source, 'notion');
  assert.equal(catalog.canales[0].nombre, 'Instagram');
  assert.equal(catalog.cuentas[0].nombre, 'IG nebulabs');
  assert.equal(selectTargetCuentas(catalog, ['Instagram'])[0].id, 'cuenta-ig');
});
