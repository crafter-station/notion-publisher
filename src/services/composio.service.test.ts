import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  buildEventbriteExecuteBody,
  buildRedditExecuteBody,
  ComposioService,
  EVENTBRITE_CREATE_EVENT_SLUG,
  toEventbriteUtc,
} from './composio.service';
import { extractComposioEventbriteContent } from './notion.service';

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

function dateRange(start: string, end?: string) {
  return { date: { start, end: end || null } };
}

function channels(...names: string[]) {
  return { multi_select: names.map(name => ({ name })) };
}

test('buildEventbriteExecuteBody matches EVENTBRITE_CREATE_EVENT arguments', () => {
  const { body, missing } = buildEventbriteExecuteBody(
    {
      organization_id: '2054240262773',
      name: 'Summer Music Festival 2026',
      start_utc: '2026-06-01T14:00:00Z',
      end_utc: '2026-06-01T18:00:00Z',
      timezone: 'America/New_York',
      currency: 'usd',
      description_html: 'Join us',
      online_event: true,
    },
    { userId: 'user-1', connectedAccountId: 'ca-eb' }
  );
  assert.equal(missing.length, 0);
  assert.equal(body.user_id, 'user-1');
  assert.equal(body.connected_account_id, 'ca-eb');
  assert.deepEqual(body.arguments, {
    organization_id: '2054240262773',
    event: {
      name: { html: '<p>Summer Music Festival 2026</p>' },
      start: { utc: '2026-06-01T14:00:00Z', timezone: 'America/New_York' },
      end: { utc: '2026-06-01T18:00:00Z', timezone: 'America/New_York' },
      currency: 'USD',
      description: { html: '<p>Join us</p>' },
      online_event: true,
    },
  });
});

test('Eventbrite dry-run does not POST /tools/execute', async () => {
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error('fetch must not run in dry-run');
  }) as typeof fetch;

  const composio = new ComposioService('test-composio-key');
  const result = await composio.createEventbriteEvent(
    {
      organization_id: 'org-1',
      name: 'Test',
      start_utc: '2026-06-01T14:00:00Z',
      end_utc: '2026-06-01T18:00:00Z',
      timezone: 'UTC',
    },
    { userId: 'u1' }
  );

  assert.equal(result.dry_run, true);
  assert.equal(result.called_publish, false);
  assert.equal(fetchCalls, 0);
  assert.equal(result.payload.arguments.organization_id, 'org-1');
});

test('Reddit dry-run still builds REDDIT_CREATE_REDDIT_POST payload', () => {
  const { body, missing } = buildRedditExecuteBody(
    { subreddit: 'r/test', title: 'Hello', kind: 'self', text: 'body' },
    { userId: 'u1' }
  );
  assert.equal(missing.length, 0);
  assert.equal(body.arguments.subreddit, 'test');
  assert.equal(body.arguments.kind, 'self');
});

test('live Eventbrite stays dry-run without COMPOSIO_PUBLISH_LIVE', async () => {
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response('{}', { status: 200 });
  }) as typeof fetch;

  const composio = new ComposioService('test-composio-key');
  const result = await composio.createEventbriteEvent(
    {
      organization_id: 'org-1',
      name: 'Test',
      start_utc: '2026-06-01T14:00:00Z',
      end_utc: '2026-06-01T18:00:00Z',
      timezone: 'UTC',
    },
    { userId: 'u1' },
    { dryRun: false }
  );
  assert.equal(result.dry_run, true);
  assert.equal(fetchCalls, 0);
});

test('toEventbriteUtc normalizes ISO timestamps', () => {
  assert.equal(toEventbriteUtc('2026-06-01T14:00:00.000Z'), '2026-06-01T14:00:00Z');
});

test('extractComposioEventbriteContent maps Notion Eventbrite fields', () => {
  const content = extractComposioEventbriteContent({
    Name: title('Fallback'),
    'Eventbrite Title': rt('EB Title'),
    'Eventbrite Description': rt('Desc'),
    'Eventbrite Start': dateRange('2026-06-01T14:00:00.000-05:00', '2026-06-01T18:00:00.000-05:00'),
    'Eventbrite Organization ID': rt('org-9'),
    'Eventbrite Online': { checkbox: true },
    Channels: channels('Eventbrite'),
    'Composio User ID': rt('user-x'),
  });
  assert.equal(content.is_complete, true);
  assert.equal(content.name, 'EB Title');
  assert.equal(content.organization_id, 'org-9');
  assert.equal(content.online_event, true);
  assert.ok(content.start_raw.includes('2026-06-01'));
  assert.ok(content.end_raw.includes('2026-06-01'));
});

test('EVENTBRITE_CREATE_EVENT slug is the Composio tool id', () => {
  assert.equal(EVENTBRITE_CREATE_EVENT_SLUG, 'EVENTBRITE_CREATE_EVENT');
});
