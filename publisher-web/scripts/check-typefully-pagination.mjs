import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
let source = await readFile(new URL('../lib/server/typefully-connections.ts', import.meta.url), 'utf8');
source = source.replace(/^import .*;\n/gm, '');
const env = { COMPOSIO_API_KEY: 'fixture-key', COMPOSIO_TYPEFULLY_CONNECTED_ACCOUNT_ID: 'account1', COMPOSIO_USER_ID: 'user1' };
const compiled = ts.transpileModule('const env=' + JSON.stringify(env) + ';\n' + source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { typefullyConnections } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const originalFetch = globalThis.fetch;
let scenario, offsets, detailIds;
const set = id => ({ id, name: 'Set ' + id });
globalThis.fetch = async (url, options) => {
  if (typeof url !== 'string') throw new Error('Expected string URL');
  assert(url.startsWith('https://backend.composio.dev/api/v3.1/'));
  assert.equal(options.headers['x-api-key'], 'fixture-key');
  if (!options.body) return Response.json({ id: 'account1', status: 'ACTIVE', toolkit: { slug: 'typefully' }, user_id: 'user1' });
  const body = JSON.parse(options.body);
  assert.equal(body.connected_account_id, 'account1');
  if (url.endsWith('TYPEFULLY_LIST_SOCIAL_SETS')) {
    offsets.push(body.arguments.offset);
    if (body.arguments.offset === 0) {
      let next = 'https://api.typefully.com/v2/social-sets?offset=50&limit=50';
      if (scenario === 'foreign') next = 'https://other.example/v2/social-sets?offset=50';
      if (scenario === 'stalled') next = 'https://api.typefully.com/v2/social-sets?offset=0';
      if (scenario === 'skip') next = 'https://api.typefully.com/v2/social-sets?offset=51';
      return Response.json({ successful: true, data: { results: Array.from({ length: 50 }, (_, i) => set(i + 1)), next } });
    }
    if (scenario === 'page-error') return new Response('', { status: 503 });
    return Response.json({ successful: true, data: { results: [set(scenario === 'duplicate' ? 1 : 51), set(52)], next: null } });
  }
  assert(url.endsWith('TYPEFULLY_GET_SOCIAL_SET'));
  detailIds.push(body.arguments.social_set_id);
  if (scenario === 'detail-error' && body.arguments.social_set_id === 52) return new Response('', { status: 403 });
  return Response.json({ successful: true, data: { id: body.arguments.social_set_id, platforms: { x: { name: 'Account ' + body.arguments.social_set_id }, linkedin: null } } });
};
try {
  for (scenario of ['success', 'foreign', 'stalled', 'skip', 'page-error', 'duplicate', 'detail-error']) {
    offsets = []; detailIds = [];
    const result = await typefullyConnections();
    if (scenario === 'success') {
      assert.equal(result.state, 'read_verified');
      assert.equal(result.groups.length, 52); assert.equal(result.accounts.length, 52);
      assert.deepEqual(offsets, [0, 50]);
      assert.deepEqual(result.groups.at(-1).channelIds, ['52:x']);
    } else {
      assert.equal(result.state, 'read_failed', scenario);
      assert.deepEqual(result.accounts, []); assert.deepEqual(result.groups, []);
      if (['foreign', 'stalled', 'skip'].includes(scenario)) assert.deepEqual(offsets, [0]);
    }
  }
  console.log('Typefully pagination passed: 52 sets, stable account identities, rejected foreign/stalled/skipped cursors, duplicate IDs and partial failures. Mock provider only.');
} finally { globalThis.fetch = originalFetch; }
