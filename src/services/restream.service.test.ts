import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { extractRestreamContent } from './notion.service';
import { buildRestreamCreatePayload, RestreamService } from './restream.service';

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

test('buildRestreamCreatePayload matches POST /v2/user/events/new', () => {
  const { payload, path, missing } = buildRestreamCreatePayload({
    streamType: 'encoder',
    title: 'My weekly show',
    description: 'Episode 12',
    scheduledFor: '2026-05-10T15:00:00Z',
  });
  assert.equal(missing.length, 0);
  assert.equal(path, '/user/events/new');
  assert.deepEqual(payload, {
    streamType: 'encoder',
    title: 'My weekly show',
    description: 'Episode 12',
    scheduledFor: '2026-05-10T15:00:00.000Z',
  });
});

test('file streamType requires fileId and refuses paid looping', () => {
  const missingFile = buildRestreamCreatePayload({
    streamType: 'file',
    title: 'Replay',
  });
  assert.ok(missingFile.missing.some(m => /fileId/.test(m)));

  const looping = buildRestreamCreatePayload({
    streamType: 'file',
    title: 'Replay',
    fileId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    loopsCount: 3,
  });
  assert.ok(looping.missing.some(m => /paid Restream looping/.test(m)));
});

test('dry-run never calls fetch; live create is refused', async () => {
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error('fetch must not run');
  }) as typeof fetch;

  const service = new RestreamService('token');
  const result = await service.createEvent({
    title: 'Studio night',
    streamType: 'studio',
    scheduledFor: '2026-10-25T15:00:00Z',
  });
  assert.equal(result.dry_run, true);
  assert.equal(result.called_publish, false);
  assert.equal(fetchCalls, 0);
  assert.equal(result.payload.streamType, 'studio');

  await assert.rejects(
    () => service.createEvent({ title: 'Nope' }, { dryRun: false }),
    /dry-run only/
  );
  assert.equal(fetchCalls, 0);
});

test('extractRestreamContent maps Notion fields', () => {
  const content = extractRestreamContent({
    Name: title('Fallback'),
    'Restream Title': rt('Weekly stream'),
    Caption: rt('Shared desc'),
    'Restream Stream Type': { select: { name: 'studio' } },
    'Restream Start': { date: { start: '2026-05-10T15:00:00.000Z' } },
  });
  assert.equal(content.is_complete, true);
  assert.equal(content.title, 'Weekly stream');
  assert.equal(content.description, 'Shared desc');
  assert.equal(content.stream_type, 'studio');
  assert.ok(content.scheduled_for.includes('2026-05-10'));
});
