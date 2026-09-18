const assert = require('node:assert/strict');
const { previewRedditNotion } = require('./preview-reddit-notion.cjs');
const id = '00000000-0000-0000-0000-000000000001', db = '00000000-0000-0000-0000-000000000002';
const config = { NOTION_TOKEN: 'private-notion-token', NOTION_DATABASE_ID: db };
const rt = text => ({ rich_text: [{ plain_text: text }] });
const page = { object: 'page', id, parent: { database_id: db }, properties: {
  Name: { title: [{ plain_text: 'Example title' }] }, Caption: rt('Inherited **Markdown**'),
  'Reddit Body': { rich_text: [] }, 'Reddit Subreddit': rt('test'),
  Channels: { multi_select: [{ name: 'Reddit' }] }, 'Source Tags': { multi_select: [{ name: 'Composio' }] },
  'Composio Connected Account ID': rt('private-account'),
} };
async function probe(value = page, status = 200) {
  const calls = [];
  const result = await previewRedditNotion(config, id, async (url, options) => {
    calls.push({ url, options }); return new Response(JSON.stringify(value), { status });
  });
  assert.equal(calls.length, 1); assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].url, `https://api.notion.com/v1/pages/${id}`);
  return result;
}
(async () => {
  const result = await probe();
  assert.equal(result.contentValid, true); assert.equal(result.routingValid, true);
  assert.equal(result.payload.text, 'Inherited **Markdown**'); assert.deepEqual(result.issues, []);
  assert.ok(!JSON.stringify(result).includes('private-'));
  const link = await probe({ ...page, properties: { ...page.properties, 'Reddit Link URL': { url: 'https://example.com' } } });
  assert.equal(link.payload.kind, 'link'); assert.equal(link.payload.url, 'https://example.com'); assert.ok(!('text' in link.payload));
  const unrouted = await probe({ ...page, properties: { ...page.properties, Channels: { multi_select: [] }, 'Source Tags': { multi_select: [] } } });
  assert.equal(unrouted.routingValid, false); assert.equal(unrouted.issues.length, 2);
  const invalid = await probe({ ...page, properties: { ...page.properties, Caption: rt('x'.repeat(40001)) } });
  assert.equal(invalid.contentValid, false);
  for (const patch of [{ id: db }, { archived: true }, { in_trash: true }, { parent: { database_id: id } }, { properties: null }, { object: 'error' }]) {
    await assert.rejects(() => probe({ ...page, ...patch }));
  }
  await assert.rejects(() => probe({ message: 'private-upstream-message' }, 401), { message: 'Notion read failed: HTTP 401' });
  await assert.rejects(() => previewRedditNotion(config, '../bad', () => { throw new Error('Must not fetch'); }), { message: 'Invalid Notion page ID' });
  await assert.rejects(() => previewRedditNotion(config, id, () => { throw new Error('private-transport-message'); }), { message: 'Notion read failed: network or redirect error' });
  console.log('Reddit Notion preview: read-only routing, inheritance, link payload, database boundary and redacted failures verified.');
})().catch(error => { console.error(error); process.exitCode = 1; });
