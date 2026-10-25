import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ContentOsReader,
  isReadyPublicacion,
  mergedPublishProperties,
  parseCanal,
  parseCuenta,
  parsePieza,
  parsePublicacion,
} from './content-os.reader';
import { NotionPage, NotionTransport } from './notion-transport';

function title(name: string, value: string) {
  return { [name]: { title: [{ plain_text: value }] } };
}
function rt(name: string, value: string) {
  return { [name]: { rich_text: [{ plain_text: value }] } };
}
function select(name: string, value: string) {
  return { [name]: { select: { name: value } } };
}
function status(name: string, value: string) {
  return { [name]: { status: { name: value } } };
}
function date(name: string, start: string) {
  return { [name]: { date: { start } } };
}
function rel(name: string, ...ids: string[]) {
  return { [name]: { relation: ids.map(id => ({ id })) } };
}

test('parsePieza / parsePublicacion use dump property names including emojis', () => {
  const pieza = parsePieza({
    id: 'pieza-1',
    properties: {
      ...title('Nombre', 'Launch clip'),
      ...status('Status', 'Lista'),
      ...rt('Caption base', 'hello world'),
      ...select('Tipo', 'Social'),
      ...rel('📡 Canales objetivo', 'canal-1'),
      ...rel('🥇 Producto', 'prod-1'),
      ...rel('🚀 Publicaciones', 'pub-1'),
    },
  });
  assert.equal(pieza.nombre, 'Launch clip');
  assert.equal(pieza.captionBase, 'hello world');
  assert.deepEqual(pieza.canalIds, ['canal-1']);
  assert.deepEqual(pieza.productoIds, ['prod-1']);

  const pub = parsePublicacion({
    id: 'pub-1',
    properties: {
      ...title('Título', 'Launch · IG'),
      ...status('Status', 'Pendiente'),
      ...select('Modo', ''),
      ...rt('Clave de idempotencia', 'publisher:old:ig'),
      ...rel('🧩 Pieza', 'pieza-1'),
      ...rel('🪪 Cuenta', 'cuenta-1'),
    },
  });
  assert.equal(pub.titulo, 'Launch · IG');
  assert.equal(pub.modo, '');
  assert.equal(pub.claveDeIdempotencia, 'publisher:old:ig');
  assert.equal(isReadyPublicacion(pub), true);
});

test('parseCuenta and parseCanal read Estado / Conector / Estado del conector', () => {
  const cuenta = parseCuenta({
    id: 'cuenta-1',
    properties: {
      ...title('Cuenta', 'IG nebulabs'),
      ...select('Estado', 'Activa'),
      ...select('Conector', 'Postly'),
      ...rel('📡 Canal', 'canal-1'),
    },
  });
  assert.equal(cuenta.estado, 'Activa');
  assert.equal(cuenta.conector, 'Postly');

  const canal = parseCanal({
    id: 'canal-1',
    properties: {
      ...title('Nombre', 'Instagram'),
      ...select('Conector', 'Postly'),
      ...select('Estado del conector', 'dry-run'),
      ...select('Familia', 'Social'),
    },
  });
  assert.equal(canal.estadoDelConector, 'dry-run');
  assert.equal(canal.familia, 'Social');
});

test('mergedPublishProperties prefers Caption override and keeps Publisher names', () => {
  const pieza = parsePieza({
    id: 'p',
    properties: { ...title('Nombre', 'P'), ...rt('Caption base', 'base') },
  });
  const pub = parsePublicacion({
    id: 'u',
    properties: { ...title('Título', 'T'), ...rt('Caption override', 'override') },
  });
  const merged = mergedPublishProperties(pieza, pub);
  assert.equal(merged.Caption.rich_text[0].plain_text, 'override');
  assert.equal(merged.Name.title[0].plain_text, 'T');
});

test('ContentOsReader.listReadyPublicaciones filters by Pieza + ready statuses', async () => {
  const pages: NotionPage[] = [
    {
      id: 'ready',
      properties: {
        ...title('Título', 'ok'),
        ...status('Status', 'Pendiente'),
        ...rel('🧩 Pieza', 'pieza-1'),
      },
    },
    {
      id: 'done',
      properties: {
        ...title('Título', 'done'),
        ...status('Status', 'Publicado'),
        ...rel('🧩 Pieza', 'pieza-1'),
      },
    },
  ];
  const transport: NotionTransport = {
    async getPage(id) {
      return { id, properties: title('Nombre', id) };
    },
    async queryAll(_db, filter: any) {
      assert.equal(filter.and[0].property, '🧩 Pieza');
      return pages;
    },
    async createPage() {
      return { id: 'new' };
    },
    async updatePage() {},
  };
  const reader = new ContentOsReader(transport, {
    piezas: 'p',
    publicaciones: 'u',
    cuentas: 'c',
    canales: 'n',
  });
  const ready = await reader.listReadyPublicaciones('pieza-1');
  assert.deepEqual(
    ready.map(p => p.id),
    ['ready']
  );
});
