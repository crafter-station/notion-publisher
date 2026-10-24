import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  buildPostizCreatePayload,
  buildPostizSettings,
  PostizService,
} from './postiz.service';
import { POSTIZ_CHANNEL_CATALOG } from './postiz-channels.catalog';
import { extractPostizContent } from './notion.service';

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

function multi(...names: string[]) {
  return { multi_select: names.map(name => ({ name })) };
}

test('catalog covers the ten Postiz channels we ship', () => {
  const ids = POSTIZ_CHANNEL_CATALOG.map(c => c.identifier).sort();
  assert.deepEqual(ids, [
    'discord',
    'kick',
    'lemmy',
    'listmonk',
    'mastodon',
    'nostr',
    'skool',
    'slack',
    'twitch',
    'warpcast',
  ]);
});

test('buildPostizSettings matches public API schemas', () => {
  assert.deepEqual(buildPostizSettings('discord', { channel: '123' }), {
    __type: 'discord',
    channel: '123',
  });
  assert.deepEqual(buildPostizSettings('slack', { channel: 'C01' }), {
    __type: 'slack',
    channel: 'C01',
  });
  assert.deepEqual(buildPostizSettings('mastodon'), { __type: 'mastodon' });
  assert.deepEqual(
    buildPostizSettings('skool', { group: 'g', label: 'l', title: 'Hello' }),
    { __type: 'skool', group: 'g', label: 'l', title: 'Hello' }
  );
  assert.deepEqual(buildPostizSettings('twitch', { messageType: 'announcement' }), {
    __type: 'twitch',
    messageType: 'announcement',
    announcementColor: 'primary',
  });
  assert.deepEqual(buildPostizSettings('kick'), { __type: 'kick' });
  assert.deepEqual(buildPostizSettings('warpcast', { channels: 'dev,builders' }), {
    __type: 'warpcast',
    subreddit: [{ value: { id: 'dev' } }, { value: { id: 'builders' } }],
  });
  assert.deepEqual(buildPostizSettings('nostr'), { __type: 'nostr' });
  assert.deepEqual(
    buildPostizSettings('lemmy', {
      community: 'opensource',
      community_id: '99',
      title: 'Why OS',
      url: 'https://example.com',
    }),
    {
      __type: 'lemmy',
      subreddit: [
        { value: { subreddit: 'opensource', id: '99', title: 'Why OS', url: 'https://example.com' } },
      ],
    }
  );
  assert.deepEqual(
    buildPostizSettings('listmonk', {
      subject: 'Sub',
      preview: 'Pre',
      list: '1',
      template: '2',
    }),
    { __type: 'listmonk', subject: 'Sub', preview: 'Pre', list: '1', template: '2' }
  );
});

test('dry-run builds the exact POST /posts payload and never calls fetch', async () => {
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error('fetch must not run in dry-run');
  }) as typeof fetch;

  const service = new PostizService('test-key', 'https://postiz.test/api/public/v1');
  const result = await service.createPost({
    type: 'draft',
    channels: [
      {
        identifier: 'discord',
        integration_id: 'int-discord',
        content: 'Hello Discord',
        settings: { channel: '111' },
      },
      {
        identifier: 'mastodon',
        integration_id: 'int-masto',
        content: 'Hello Masto',
      },
    ],
  });

  assert.equal(result.dry_run, true);
  assert.equal(result.called_publish, false);
  assert.equal(fetchCalls, 0);
  assert.equal(result.payload.type, 'draft');
  assert.equal(result.payload.shortLink, false);
  assert.equal(result.payload.posts.length, 2);
  assert.deepEqual(result.payload.posts[0], {
    integration: { id: 'int-discord' },
    value: [{ content: 'Hello Discord', image: [] }],
    settings: { __type: 'discord', channel: '111' },
  });
  assert.equal(result.payload.posts[1].settings.__type, 'mastodon');
});

test('payload validation rejects incomplete required settings', () => {
  const { missing } = buildPostizCreatePayload({
    channels: [
      { identifier: 'discord', integration_id: 'x', content: 'hi', settings: {} },
      {
        identifier: 'skool',
        integration_id: 'y',
        content: 'body',
        settings: { group: 'g' },
      },
    ],
  });
  assert.ok(missing.some(m => /Discord settings.channel/.test(m)));
  assert.ok(missing.some(m => /Skool settings.label/.test(m)));
  assert.ok(missing.some(m => /Skool settings.title/.test(m)));
});

test('type=now is rewritten to draft so dry-run never publishes immediately', () => {
  const { payload, missing } = buildPostizCreatePayload({
    type: 'now',
    channels: [
      {
        identifier: 'kick',
        integration_id: 'int-kick',
        content: 'going live',
      },
    ],
  });
  assert.equal(missing.length, 0);
  assert.equal(payload.type, 'draft');
});

test('live create is still blocked without POSTIZ_PUBLISH_LIVE (mocked HTTP unused)', async () => {
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  const service = new PostizService('test-key');
  const result = await service.createPost(
    {
      channels: [
        {
          identifier: 'nostr',
          integration_id: 'int-nostr',
          content: 'note',
        },
      ],
    },
    { dryRun: false }
  );

  assert.equal(result.dry_run, true);
  assert.equal(result.called_publish, false);
  assert.equal(fetchCalls, 0);
});

test('extractPostizContent maps caption, targets, and channel settings', () => {
  const content = extractPostizContent({
    Name: title('Weekly'),
    Caption: rt('Shared caption'),
    'Postiz Targets': multi('Discord', 'Lemmy', 'Listmonk'),
    'Postiz Discord Channel': rt('999'),
    'Postiz Lemmy Community': rt('opensource'),
    'Postiz Lemmy Community ID': rt('42'),
    'Postiz Lemmy Title': rt('OS post'),
    'Postiz Listmonk Subject': rt('Hello'),
    'Postiz Listmonk Preview': rt('preview'),
    'Postiz Listmonk List': rt('1'),
    'Postiz Discord Integration ID': rt('int-d'),
  });
  assert.equal(content.is_complete, true);
  assert.equal(content.caption, 'Shared caption');
  assert.deepEqual(content.targets, ['Discord', 'Lemmy', 'Listmonk']);
  assert.equal(content.settings.discord.channel, '999');
  assert.equal(content.settings.lemmy.community, 'opensource');
  assert.equal(content.integration_ids.discord, 'int-d');
});
