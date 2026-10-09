import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = (await readFile(new URL('../lib/server/reddit-connections.ts', import.meta.url), 'utf8')).replace("import { env } from 'cloudflare:workers';", 'const env = globalThis.redditTestEnvironment;');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const config = {}; globalThis.redditTestEnvironment = config;
const { redditConnections } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const originalFetch = globalThis.fetch;
const account = { id: 'reddit-account', user_id: 'owner', toolkit: { slug: 'reddit' }, status: 'ACTIVE' };
let listing = { items: [account] }, tool = { successful: true, data: { kind: 't2', data: { id: 'user-id', name: 'fixture-user', is_suspended: false } } }, calls = [];
globalThis.fetch = async (url, options) => {
  calls.push(url);
  assert.equal(options.redirect, 'manual');
  if (options.method === 'POST') {
    assert.ok(url.endsWith('/tools/execute/REDDIT_GET_REDDIT_USER_ABOUT'));
    assert.deepEqual(JSON.parse(options.body), { user_id: 'owner', connected_account_id: 'reddit-account', version: '20260826_00', arguments: { username: 'me' } });
  }
  return new Response(JSON.stringify(options.method === 'POST' ? tool : listing));
};
try {
  assert.equal((await redditConnections()).state, 'missing_configuration');
  assert.equal(calls.length, 0);
  Object.assign(config, { COMPOSIO_API_KEY: 'test', COMPOSIO_USER_ID: 'owner' });
  const verified = await redditConnections();
  assert.equal(verified.state, 'read_verified');
  assert.equal(verified.accounts[0].channel, 'reddit');
  assert.equal(verified.accounts[0].name, 'u/fixture-user');
  assert.ok(!JSON.stringify(verified).includes('user-id'));
  tool.data.data.is_suspended = true;
  assert.equal((await redditConnections()).accounts[0].connected, false);
  tool.data.data.is_suspended = false;
  for (const value of [
    { items: [{ ...account, user_id: 'other' }] },
    { items: [{ ...account, toolkit: { slug: 'typefully' } }] },
    { items: [account, { ...account, id: 'second' }] },
    { items: [account], next_cursor: 'more' },
    { items: [{ ...account, status: 'EXPIRED' }] },
  ]) {
    listing = value; calls = [];
    assert.equal((await redditConnections()).state, 'missing_configuration');
    assert.equal(calls.length, 1);
  }
  listing = { items: [account] };
  config.COMPOSIO_REDDIT_CONNECTED_ACCOUNT_ID = 'wrong';
  assert.equal((await redditConnections()).accounts.length, 0);
  config.COMPOSIO_REDDIT_CONNECTED_ACCOUNT_ID = account.id;
  assert.equal((await redditConnections()).state, 'read_verified');
  tool = { successful: false, data: { lang: 'en' } };
  assert.equal((await redditConnections()).state, 'read_failed');
  tool = { successful: true, data: {} };
  assert.equal((await redditConnections()).state, 'read_failed');
  globalThis.fetch = async () => { throw new Error('private upstream detail'); };
  assert.ok(!JSON.stringify(await redditConnections()).includes('private upstream'));
  console.log('Reddit inventory checks passed: read-only operation, owner isolation, ambiguity, response validation and redaction.');
} finally { globalThis.fetch = originalFetch; delete globalThis.redditTestEnvironment; }
