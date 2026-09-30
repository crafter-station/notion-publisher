const assert = require('node:assert/strict');
const { checkTypefullyConnection } = require('./lib/typefully-connection.cjs');
const env = { COMPOSIO_API_KEY: 'fixture-secret', COMPOSIO_CONNECTED_ACCOUNT_ID: 'reddit-account' };
const account = { id: 'typefully-account', user_id: 'owner', status: 'ACTIVE', toolkit: { slug: 'typefully' } };
const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
async function main() {
  assert.equal((await checkTypefullyConnection({})).state, 'missing_configuration');
  assert.equal((await checkTypefullyConnection(env, async () => json({ items: [] }))).state, 'missing_connection');
  assert.equal((await checkTypefullyConnection(env, async () => json({ items: [account, { ...account, id: 'second' }] }))).state, 'account_selection_required');
  assert.equal((await checkTypefullyConnection(env, async () => json({ items: [account], next_cursor: 'more' }))).state, 'account_selection_required');
  assert.equal((await checkTypefullyConnection({ ...env, COMPOSIO_TYPEFULLY_CONNECTED_ACCOUNT_ID: 'gone' }, async () => json({ items: [account] }))).state, 'configured_account_unavailable');
  const calls = [];
  const result = await checkTypefullyConnection(env, async (url, options) => {
    calls.push({ url, options });
    return calls.length === 1 ? json({ items: [account] }) : json({ successful: true, data: { results: [] } });
  });
  assert.equal(result.state, 'read_verified');
  assert.equal(calls.length, 2);
  const body = JSON.parse(calls[1].options.body);
  assert.equal(body.connected_account_id, account.id);
  assert.equal(body.user_id, account.user_id);
  assert.deepEqual(body.arguments, { limit: 50, offset: 0 });
  assert.equal(calls[1].options.redirect, 'error');
  const failed = await checkTypefullyConnection(env, async () => new Response('fixture-secret', { status: 401 }));
  assert.equal(failed.state, 'failed');
  assert.ok(!JSON.stringify(failed).includes('fixture-secret'));
  let count = 0;
  const rejected = await checkTypefullyConnection(env, async () => ++count === 1 ? json({ items: [account] }) : json({ successful: false, error: 'fixture-secret' }));
  assert.equal(rejected.state, 'tool_failed');
  assert.ok(!JSON.stringify(rejected).includes('fixture-secret'));
  console.log('Typefully connection checks passed: server identity, account selection, tool success and redaction.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
