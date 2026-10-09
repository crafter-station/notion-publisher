import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('This check is local-only.');
assert.equal((await fetch(base + '/api/v1/notion')).status, 401);
const login = await fetch(base + '/signin-with-chatgpt?return_to=/', { redirect: 'manual' });
const cookie = login.headers.get('set-cookie')?.split(';')[0];
assert(cookie);
const headers = { cookie };
const response = await fetch(base + '/api/v1/notion', { headers });
assert.equal(response.status, 200, 'Live Notion read must succeed');
const first = await response.json();
assert.equal(first.connection, 'read_verified');
assert(first.properties.some((p) => p.name === 'Source Tags'));
assert(first.items.length <= 50);
assert(first.items.every((p) => typeof p.id === 'string' && Array.isArray(p.sources)));
if (first.nextCursor) {
  const next = await fetch(base + '/api/v1/notion?cursor=' + encodeURIComponent(first.nextCursor), { headers });
  assert.equal(next.status, 200);
  const second = await next.json();
  assert(second.items.length > 0);
  assert.notEqual(second.items[0].id, first.items[0]?.id);
}
assert.equal((await fetch(base + '/api/v1/notion?cursor=' + 'x'.repeat(4097), { headers })).status, 400);
assert.equal((await fetch(base + '/sources')).status, 200);
console.log(JSON.stringify({ check: 'Authenticated live Notion inventory, next page, cursor validation and anonymous denial', properties: first.properties.length, firstPageCount: first.items.length, hasMore: !!first.nextCursor, result: 'passed' }));
