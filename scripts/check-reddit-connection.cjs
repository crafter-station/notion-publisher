const assert = require('node:assert/strict');
const { checkRedditConnection } = require('./lib/reddit-connection.cjs');
const env = { COMPOSIO_API_KEY: 'test-only', COMPOSIO_USER_ID: 'owner' };
const account = { id: 'reddit-account', user_id: 'owner', status: 'ACTIVE', toolkit: { slug: 'reddit' } };
async function probe(listing, payload, config = env) {
  const calls = [];
  const result = await checkRedditConnection(config, async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify(calls.length === 1 ? listing : payload), { status: 200 });
  });
  return { result, calls };
}
(async () => {
  const success = await probe({ items: [account] }, { successful: true, data: { lang: 'en' } });
  assert.equal(success.result.state, 'read_verified');
  assert.equal(success.calls.length, 2);
  assert.ok(success.calls[1].url.endsWith('/tools/execute/REDDIT_GET_ME_PREFS'));
  assert.deepEqual(JSON.parse(success.calls[1].options.body), { user_id: 'owner', connected_account_id: 'reddit-account', version: '20260826_00', arguments: { fields: 'lang' } });
  assert.ok(!JSON.stringify(success.result).includes('test-only'));
  for (const [listing, state, config] of [
    [{ items: [] }, 'missing_connection'],
    [{ items: [account, { ...account, id: 'second' }] }, 'account_selection_required'],
    [{ items: [account], next_cursor: 'more' }, 'account_selection_required'],
    [{ items: [{ ...account, user_id: 'other' }] }, 'account_owner_mismatch'],
    [{ items: [account] }, 'configured_account_unavailable', { ...env, COMPOSIO_REDDIT_CONNECTED_ACCOUNT_ID: 'wrong' }],
    [{ items: [{ ...account, status: 'EXPIRED' }] }, 'connection_inactive', { ...env, COMPOSIO_REDDIT_CONNECTED_ACCOUNT_ID: account.id }],
  ]) {
    const p = await probe(listing, {}, config);
    assert.equal(p.result.state, state);
    assert.equal(p.calls.length, 1);
  }
  assert.equal((await probe({ items: [account] }, { successful: false })).result.state, 'tool_failed');
  assert.equal((await probe({ items: [account] }, { successful: true, data: {} })).result.state, 'invalid_response');
  console.log('Reddit read probe: authenticated shape, owner, ambiguity, selection and failures verified.');
})().catch(error => { console.error(error); process.exitCode = 1; });
