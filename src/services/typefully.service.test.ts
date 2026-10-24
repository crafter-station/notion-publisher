import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { extractTypefullyContent } from './notion.service';
import {
  buildTypefullyDraftPayload,
  TypefullyService,
} from './typefully.service';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function rt(s: string) {
  return { rich_text: [{ plain_text: s }] };
}

function title(s: string) {
  return { title: [{ plain_text: s }] };
}

test('buildTypefullyDraftPayload enables only platforms with text and never sets publish_at', () => {
  const built = buildTypefullyDraftPayload({
    social_set_id: 303310,
    draft_title: 'Weekly',
    plan_at: '2026-12-20T09:00:00-05:00',
    platforms: {
      x: 'Tweet one\n\n\n\nTweet two',
      linkedin: 'LI post',
      mastodon: 'Toot',
    },
  });
  assert.equal(built.missing.length, 0);
  assert.equal(built.path, '/v2/social-sets/303310/drafts');
  assert.equal(built.payload.share, false);
  assert.equal(built.payload.plan_at, '2026-12-20T09:00:00-05:00');
  assert.ok(!('publish_at' in built.payload));
  assert.deepEqual(built.payload.platforms.x, {
    enabled: true,
    posts: [{ text: 'Tweet one' }, { text: 'Tweet two' }],
  });
  assert.deepEqual(built.payload.platforms.linkedin, {
    enabled: true,
    posts: [{ text: 'LI post' }],
  });
  assert.equal(built.payload.platforms.threads, undefined);
  assert.equal(built.payload.platforms.bluesky, undefined);
});

test('dry-run validates payload and does not call fetch', async () => {
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error('fetch must not run in dry-run');
  }) as typeof fetch;

  const service = new TypefullyService('tf-key');
  const result = await service.createDraft({
    social_set_id: 1,
    platforms: { bluesky: 'hello bsky', threads: 'hello threads' },
  });

  assert.equal(result.dry_run, true);
  assert.equal(result.called_publish, false);
  assert.equal(fetchCalls, 0);
  assert.equal(result.payload.path, '/v2/social-sets/1/drafts');
  assert.ok(result.payload.platforms.bluesky && result.payload.platforms.bluesky.enabled);
  assert.ok(!('publish_at' in result.payload));
});

test('live create stays dry-run without TYPEFULLY_PUBLISH_LIVE', async () => {
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response('{}', { status: 201 });
  }) as typeof fetch;

  const service = new TypefullyService('tf-key');
  const result = await service.createDraft(
    { social_set_id: 2, platforms: { x: 'hi' } },
    { dryRun: false }
  );
  assert.equal(result.dry_run, true);
  assert.equal(fetchCalls, 0);
});

test('extractTypefullyContent uses Caption fallback and Typefully Account', () => {
  const content = extractTypefullyContent({
    Name: title('Draft title'),
    Caption: rt('Shared caption'),
    'LinkedIn Post': rt('LI only'),
    'Typefully Mastodon': rt('Masto'),
    'Typefully Account': rt('303310'),
    'Typefully Thread': rt('part two'),
  });
  assert.equal(content.is_complete, true);
  assert.equal(content.social_set_id, '303310');
  assert.ok(content.platforms.x?.includes('Shared caption'));
  assert.ok(content.platforms.x?.includes('part two'));
  assert.ok(content.platforms.linkedin?.startsWith('LI only'));
  assert.ok(content.platforms.mastodon?.startsWith('Masto'));
});
