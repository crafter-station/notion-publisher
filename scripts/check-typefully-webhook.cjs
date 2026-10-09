require('ts-node/register');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { createTypefullyWebhook } = require('../src/controllers/typefully-webhook.controller');
const token = 'fixture-token-'.repeat(4), pageId = '12345678-1234-1234-1234-1234567890ab';
async function main() {
 const calls = [];
 const handler = createTypefullyWebhook(token, async id => { calls.push(id); return { id: 42, status: 'draft' }; });
 const disabled = createTypefullyWebhook('', async () => { throw new Error('should not execute'); });
 const failing = createTypefullyWebhook(token, async () => { throw new Error('secret-upstream-token'); });
 const server = http.createServer((req, res) => (req.url === '/disabled' ? disabled : req.url === '/failed' ? failing : handler)(req, res));
 server.listen(0, '127.0.0.1'); await once(server, 'listening');
 const base = 'http://127.0.0.1:' + server.address().port;
 const request = (body, headers = {}, route = '/') => fetch(base + route, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
 try {
  assert.equal((await request({ page_id: pageId }, { Authorization: 'Bearer wrong' })).status, 401);
  assert.equal((await request({ page_id: pageId }, { Origin: 'https://example.com' })).status, 403);
  assert.equal((await request({ page_id: pageId }, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await request('{')).status, 400);
  assert.equal((await request({ page_id: '../escape' })).status, 400);
  assert.equal((await request({ page_id: pageId, data: { id: 'abcdefabcdefabcdefabcdefabcdefab' } })).status, 400);
  assert.equal((await request('x'.repeat(1_000_001))).status, 413);
  assert.equal(calls.length, 0);
  assert.equal((await request({ data: { id: pageId, properties: { Caption: 'untrusted' } }, publish_at: 'now' })).status, 200);
  assert.deepEqual(calls, [pageId]);
  assert.equal((await request({ page_id: pageId })).status, 200);
  assert.equal((await request({ page_id: pageId }, {}, '/disabled')).status, 503);
  const failure = await request({ page_id: pageId }, {}, '/failed');
  assert.equal(failure.status, 502); assert.ok(!(await failure.text()).includes('secret-upstream-token'));
  const method = await fetch(base); assert.equal(method.status, 405); assert.equal(method.headers.get('allow'), 'POST');
  console.log('Typefully HTTP checks passed: auth, body bounds, payload validation, metadata isolation, disabled configuration and error redaction.');
 } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
