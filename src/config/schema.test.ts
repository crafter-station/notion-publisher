import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CONTENT_OS_BASE_IDS,
  CONTENT_OS_PARENT_PAGE_ID_DEFAULT,
  CONTENT_OS_PUBLISH_LIVE_ENV,
  CONTENT_OS_WORKSPACES_DATA_SOURCE_ID,
  listDeclaredPropertyNames,
  SCHEMA_BASES,
} from './schema';
import { contentOsDatabaseId, contentOsPublishLiveEnabled, propertyName } from './content-os';

test('Content OS bases have a state field and a date field', () => {
  for (const id of CONTENT_OS_BASE_IDS) {
    const base = SCHEMA_BASES[id];
    const types = Object.values(base.properties).map(p => p.type);
    assert.ok(
      types.includes('status') || types.includes('select'),
      `${id} missing status/select state field`
    );
    assert.ok(types.includes('date'), `${id} missing date`);
    assert.ok(base.emoji, `${id} missing emoji`);
    assert.ok(base.defaultDatabaseId, `${id} missing default database id`);
  }
});

test('relations carry the live Content OS emojis', () => {
  const names = new Set(listDeclaredPropertyNames());
  for (const emojiName of ['🧩 Pieza', '🪪 Cuenta', '📡 Canal', '🥇 Producto', '🚀 Publicaciones']) {
    assert.ok(names.has(emojiName), `missing ${emojiName}`);
  }
});

test('Publisher schema still declares extract* property names', () => {
  const required = [
    'Caption',
    'Restream Title',
    'Eventbrite Title',
    'Postiz Targets',
    'Typefully Account',
  ];
  const names = new Set(listDeclaredPropertyNames('publisher'));
  for (const name of required) assert.ok(names.has(name), `missing ${name}`);
});

test('property names resolve from dump defaults and env overrides', () => {
  assert.equal(propertyName('piezas', 'nombre'), 'Nombre');
  assert.equal(propertyName('publicaciones', 'pieza'), '🧩 Pieza');
  const prev = process.env.NOTION_PROP_PIEZAS_NOMBRE;
  process.env.NOTION_PROP_PIEZAS_NOMBRE = 'Pieza';
  try {
    assert.equal(propertyName('piezas', 'nombre'), 'Pieza');
  } finally {
    if (prev === undefined) delete process.env.NOTION_PROP_PIEZAS_NOMBRE;
    else process.env.NOTION_PROP_PIEZAS_NOMBRE = prev;
  }
});

test('CONTENT_OS_PUBLISH_LIVE stays off unless explicitly true', () => {
  const prev = process.env[CONTENT_OS_PUBLISH_LIVE_ENV];
  delete process.env[CONTENT_OS_PUBLISH_LIVE_ENV];
  assert.equal(contentOsPublishLiveEnabled(), false);
  process.env[CONTENT_OS_PUBLISH_LIVE_ENV] = 'true';
  assert.equal(contentOsPublishLiveEnabled(), true);
  if (prev === undefined) delete process.env[CONTENT_OS_PUBLISH_LIVE_ENV];
  else process.env[CONTENT_OS_PUBLISH_LIVE_ENV] = prev;
});

test('database ids default to the live Content OS pages', () => {
  const prev = process.env.NOTION_PIEZAS_DATABASE_ID;
  delete process.env.NOTION_PIEZAS_DATABASE_ID;
  assert.equal(contentOsDatabaseId('piezas'), '0733dfa0b7fa430d8a8fb4b97693ea17');
  if (prev !== undefined) process.env.NOTION_PIEZAS_DATABASE_ID = prev;
});

test('v2 Piezas design fields and expanded Marca stay declared', () => {
  const piezas = SCHEMA_BASES.piezas.properties;
  assert.equal(piezas.modulo.name, 'Módulo');
  assert.equal(piezas.formato.name, 'Formato');
  assert.equal(piezas.ratio.name, 'Ratio');
  assert.equal(piezas.tamanoPx.name, 'Tamaño px');
  assert.equal(piezas.slides.type, 'number');
  assert.equal(piezas.codigoDePlantilla.name, 'Código de plantilla');
  assert.equal(piezas.templateOrigenFuturaria.name, 'Template origen Futuraria');
  assert.equal(piezas.statusDeDiseno.name, 'Status de diseño');
  assert.equal(piezas.claveDeIdempotencia.name, 'Clave de idempotencia');
  assert.equal(piezas.claveDeIdempotencia.type, 'rich_text');
  for (const brand of ['TheVeller', 'Núcleo', 'Crafter', 'Sundai', 'hack0', 'GPT-Chain', 'Notion']) {
    assert.ok(piezas.marca.options?.includes(brand), `missing Piezas Marca ${brand}`);
  }
  assert.deepEqual(SCHEMA_BASES.cuentas.properties.marca.options, ['nebulabs', 'gptchain']);
  assert.equal(SCHEMA_BASES.publicaciones.properties.imageVersion.name, 'Image (versión)');
  assert.equal(SCHEMA_BASES.publicaciones.properties.imageVersion.type, 'files');
  assert.equal(CONTENT_OS_PARENT_PAGE_ID_DEFAULT, '404da2435b4681eebbe6c73f68060bdd');
  assert.equal(CONTENT_OS_WORKSPACES_DATA_SOURCE_ID, 'e28e7216-8dc3-4a77-a7ef-e81606bf39c8');
});
