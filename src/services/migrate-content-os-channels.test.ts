import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STATIC_CANALES, STATIC_CUENTAS } from '../catalog/channels';
import { NotionTransport } from '../readers/notion-transport';
import {
  inferTargets,
  loadPublisherSnapshot,
  migrateContentOs,
  parseChannelList,
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

function assertNoQuoteOrBracket(names: string[]): void {
  for (const name of names) {
    assert.equal(/["'`[\]]/.test(name), false, `channel token still has quote/bracket: ${JSON.stringify(name)}`);
  }
}

test('parseChannelList accepts a JSON-array string', () => {
  assert.deepEqual(parseChannelList('["WhatsApp","Facebook"]'), ['WhatsApp', 'Facebook']);
  assert.deepEqual(parseChannelList(' ["WhatsApp", "Facebook"] '), ['WhatsApp', 'Facebook']);
});

test('parseChannelList accepts a real array', () => {
  assert.deepEqual(parseChannelList(['WhatsApp', 'Facebook']), ['WhatsApp', 'Facebook']);
  assert.deepEqual(parseChannelList([{ name: 'WhatsApp' }, { name: 'Facebook' }]), ['WhatsApp', 'Facebook']);
});

test('parseChannelList splits a comma list', () => {
  assert.deepEqual(parseChannelList('WhatsApp, Facebook'), ['WhatsApp', 'Facebook']);
});

test('parseChannelList splits a semicolon list', () => {
  assert.deepEqual(parseChannelList('WhatsApp; Facebook'), ['WhatsApp', 'Facebook']);
});

test('parseChannelList falls back on a malformed bracket string and strips quotes/brackets', () => {
  assert.deepEqual(parseChannelList('[WhatsApp, Facebook]'), ['WhatsApp', 'Facebook']);
  assert.deepEqual(parseChannelList('["WhatsApp","Facebook"'), ['WhatsApp', 'Facebook']);
  assert.deepEqual(parseChannelList("['WhatsApp'; 'Facebook']"), ['WhatsApp', 'Facebook']);
  assertNoQuoteOrBracket(parseChannelList('[WhatsApp, Facebook]'));
  assertNoQuoteOrBracket(parseChannelList('["UnknownNet"]'));
});

test('flat snapshot Channels JSON-array string and unmatched_channels never contain quotes or brackets', async () => {
  const jsonRow = loadPublisherSnapshot([
    { page_id: 'c-json', Name: 'JSON channels', Layer: 'Social', Channels: '["Instagram","X"]' },
  ])[0];
  assert.deepEqual(jsonRow.channels, ['Instagram', 'X']);
  assert.deepEqual(
    inferTargets(jsonRow, STATIC).targets.map(t => t.canalNombre),
    ['Instagram', 'X']
  );

  const quoted = loadPublisherSnapshot([
    {
      page_id: 'c-json-unknown',
      Name: 'Quoted unknown',
      Layer: 'Social',
      Channels: '["UnknownNet","AlsoBad"]',
    },
  ]);
  const malformed = loadPublisherSnapshot([
    {
      page_id: 'c-bad',
      Name: 'Bad brackets',
      Layer: 'Social',
      Channels: '[UnknownNet; AlsoBad]',
    },
  ]);
  assert.deepEqual(quoted[0].channels, ['UnknownNet', 'AlsoBad']);
  assert.deepEqual(malformed[0].channels, ['UnknownNet', 'AlsoBad']);
  assertNoQuoteOrBracket(inferTargets(quoted[0], STATIC).unmatched);
  assertNoQuoteOrBracket(inferTargets(malformed[0], STATIC).unmatched);

  const report = await migrateContentOs({
    rows: [...quoted, ...malformed],
    catalog: STATIC,
    transport: fakeTransport(),
    ids: { piezas: 'piezas', publicaciones: 'pubs' },
    dryRun: true,
    offline: true,
  });
  assert.equal(report.status, 'error');
  assert.deepEqual(report.unmatched_channels, ['UnknownNet', 'AlsoBad']);
  assertNoQuoteOrBracket(report.unmatched_channels);
});
