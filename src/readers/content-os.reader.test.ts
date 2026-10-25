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

function file(name: string, url: string) {
  return { [name]: { files: [{ type: 'external', external: { url } }] } };
}

test('parsePieza reads optional v2 design fields without requiring them', () => {
  const empty = parsePieza({ id: 'p', properties: title('Nombre', 'P') });
  assert.equal(empty.modulo, '');
  assert.equal(empty.slides, null);

  const pieza = parsePieza({
    id: 'p2',
    properties: {
      ...title('Nombre', 'Carousel'),
      ...select('Módulo', 'Content'),
      ...select('Formato', 'carrusel'),
      ...select('Ratio', '4:5'),
      ...rt('Tamaño px', '1080x1350'),
      Slides: { number: 5 },
      ...rt('Código de plantilla', 'tpl-1'),
      ...rt('Template origen Futuraria', 'fut-9'),
      ...select('Status de diseño', 'Aprobado'),
    },
  });
  assert.equal(pieza.modulo, 'Content');
  assert.equal(pieza.formato, 'carrusel');
  assert.equal(pieza.ratio, '4:5');
  assert.equal(pieza.tamanoPx, '1080x1350');
  assert.equal(pieza.slides, 5);
  assert.equal(pieza.codigoDePlantilla, 'tpl-1');
  assert.equal(pieza.templateOrigenFuturaria, 'fut-9');
  assert.equal(pieza.statusDeDiseno, 'Aprobado');
});

test('mergedPublishProperties uses Image (versión) over Pieza Image', () => {
  const pieza = parsePieza({
    id: 'p',
    properties: { ...title('Nombre', 'P'), ...file('Image', 'https://cdn.example/pieza.png') },
  });
  const fallback = parsePublicacion({ id: 'u1', properties: title('Título', 'T') });
  assert.equal(
    mergedPublishProperties(pieza, fallback).Image.files[0].external.url,
    'https://cdn.example/pieza.png'
  );

  const override = parsePublicacion({
    id: 'u2',
    properties: {
      ...title('Título', 'T'),
      ...file('Image (versión)', 'https://cdn.example/version.png'),
    },
  });
  assert.equal(override.imageVersionUrl, 'https://cdn.example/version.png');
  assert.equal(
    mergedPublishProperties(pieza, override).Image.files[0].external.url,
    'https://cdn.example/version.png'
  );
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
