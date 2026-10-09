require('ts-node/register');
const assert = require('node:assert/strict');
const { TypefullyService } = require('../src/services/typefully.service');
const { PostizService } = require('../src/services/postiz.service');
const { providerRequest } = require('../src/services/provider-http');

async function main() {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options, body: options.body && JSON.parse(options.body) });
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const typefully = new TypefullyService('fixture-token');
    const draft = { platforms: { x: { enabled: true, posts: [{ text: 'Draft', subscribers_only: true }] } } };
    await typefully.createDraft(123, draft);
    assert.equal(calls[0].url, 'https://api.typefully.com/v2/social-sets/123/drafts');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer fixture-token');
    assert.equal(calls[0].options.redirect, 'error');
    assert.equal(calls[0].body.publish_at, undefined);
    assert.equal(calls[0].body.platforms.x.posts[0].subscribers_only, true);
    assert.throws(() => typefully.createDraft(123, { ...draft, publish_at: 'now' }));
    assert.throws(() => typefully.scheduleDraft(123, 1, '2000-01-01'));
    assert.throws(() => new TypefullyService('').getMe());
    const post = { integration: { id: 'channel-1' }, value: [{ content: 'Draft', image: [] }], settings: { __type: 'youtube', title: 'Title', type: 'private' } };
    await new PostizService('fixture-token').createPosts([post]);
    assert.equal(calls[1].body.type, 'draft');
    assert.equal(calls[1].options.headers.Authorization, 'fixture-token');
    assert.equal(calls[1].body.posts[0].settings.title, 'Title');
    assert.throws(() => new PostizService('fixture-token').createPosts([post], 'schedule', '2000-01-01'));
    await assert.rejects(providerRequest('http://example.com', '/posts', 'fixture-token'));
    await providerRequest('http://127.0.0.1:4007/api/public/v1', '/integrations', 'fixture-token');
    assert.equal(calls.at(-1).url, 'http://127.0.0.1:4007/api/public/v1/integrations');
    await assert.rejects(providerRequest('http://localhost.evil.test', '/posts', 'fixture-token'));
    let attempts = 0;
    global.fetch = async () => { attempts++; return new Response('upstream secret body', { status: 503 }); };
    await assert.rejects(typefully.createDraft(123, draft), error => error.message === 'Provider request failed: HTTP 503');
    assert.equal(attempts, 1, 'Ambiguous writes must not retry automatically');
    console.log('Provider contract checks passed: drafts, auth, settings, validation, redaction, no automatic write retries.');
  } finally {
    global.fetch = originalFetch;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
