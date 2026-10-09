require('ts-node/register');
const assert = require('node:assert/strict');
const { ComposioService } = require('../src/services/composio.service');
async function main() {
 const original = global.fetch, calls = [];
 const account = { id: 'ca_fixture', user_id: 'owner', status: 'ACTIVE', toolkit: { slug: 'typefully' } };
 try {
  global.fetch = async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify(calls.length === 1 ? account : { successful: true, data: { id: 42 } })); };
  const service = new ComposioService('fixture-token');
  const auth = await service.resolveTypefullyAccount('ca_fixture', 'owner');
  await service.createTypefullyDraft({ social_set_id: 33552, platforms: { x: { enabled: true, posts: [{ text: 'Private' }] } }, publish_at: 'now' }, auth);
  const payload = JSON.parse(calls[1].options.body);
  assert.equal(payload.connected_account_id, 'ca_fixture');
  assert.equal(payload.user_id, 'owner');
  assert.equal(payload.version, '20260908_00');
  assert.equal(payload.arguments.publish_at, undefined);
  assert.equal(payload.arguments.share, false);
  assert.equal(calls[1].options.redirect, 'error');
  assert.ok(calls[1].options.signal);
  global.fetch = async () => new Response(JSON.stringify(account));
  await assert.rejects(service.resolveTypefullyAccount('ca_fixture', 'other'), /another owner/);
  global.fetch = async () => new Response(JSON.stringify({ ...account, toolkit: { slug: 'reddit' } }));
  await assert.rejects(service.resolveTypefullyAccount('ca_fixture', 'owner'), /another owner/);
  console.log('Typefully API checks passed: explicit owner/account, draft-only payload, toolkit pin and request deadline.');
 } finally { global.fetch = original; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
