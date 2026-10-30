import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { NOTION_RICH_TEXT_LIMIT, truncateNotionRichText, updatePostlyMetadata } from './notion.service';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('truncateNotionRichText cuts on a line, not mid-plan', () => {
  const head = 'instagram: accepted:accepted kept=1\n';
  const tail = 'facebook: trimmed:unknown_extension kept=1';
  const filler = 'x: accepted:accepted kept=1\n'.repeat(200);
  const value = head + filler + tail;
  assert.ok(value.length > NOTION_RICH_TEXT_LIMIT);
  const truncated = truncateNotionRichText(value);
  assert.ok(truncated.length <= NOTION_RICH_TEXT_LIMIT);
  assert.equal(truncated.includes('\n'), true);
  assert.equal(truncated.endsWith('\n'), false);
  assert.match(truncated, /^instagram: accepted:accepted kept=1/);
  assert.equal(truncated.includes(tail), false);
});

test('updatePostlyMetadata truncates a long plan on a line boundary', async () => {
  const patches: Array<Record<string, unknown>> = [];
  globalThis.fetch = (async (_url, init) => {
    patches.push(JSON.parse(String(init?.body || '{}')));
    return new Response('{}', { status: 200 });
  }) as typeof fetch;

  const longPlan = `${'instagram: accepted:accepted kept=1\n'.repeat(120)}facebook: trimmed:filtered_incompatible kept=4`;
  const ids = Array.from({ length: 8 }, (_, i) => `network-${i}: id-${i}`).join('\n');
  assert.ok(longPlan.length > NOTION_RICH_TEXT_LIMIT);
  assert.ok(ids.length <= NOTION_RICH_TEXT_LIMIT);

  const result = await updatePostlyMetadata('page-1', {
    postly_status: 'Published',
    post_id: ids,
    postly_plan: longPlan,
  });

  assert.equal(result.success, true);
  assert.equal(patches.length, 1);
  const properties = patches[0].properties as Record<string, { rich_text?: Array<{ text: { content: string } }> }>;
  assert.equal(properties['Post ID'].rich_text?.[0].text.content, ids);
  const plan = properties['Postly Plan'].rich_text?.[0].text.content || '';
  assert.ok(plan.length <= NOTION_RICH_TEXT_LIMIT);
  assert.notEqual(plan, longPlan);
});

test('updatePostlyMetadata truncates a >2000-char Post ID on a line boundary', async () => {
  const patches: Array<Record<string, unknown>> = [];
  globalThis.fetch = (async (_url, init) => {
    patches.push(JSON.parse(String(init?.body || '{}')));
    return new Response('{}', { status: 200 });
  }) as typeof fetch;

  const ids = Array.from({ length: 20 }, (_, i) => {
    const name = `network-${String(i).padStart(2, '0')}`;
    return `${name}: ERR: ${'e'.repeat(100)}`;
  }).join('\n');
  assert.ok(ids.length > NOTION_RICH_TEXT_LIMIT);

  const result = await updatePostlyMetadata('page-long-ids', {
    postly_status: 'Failed',
    postly_url: 'https://example.com/post',
    post_id: ids,
    postly_plan: 'instagram: rejected:no_media kept=0',
    final_status: 'Error',
  });

  assert.equal(result.success, true);
  assert.equal(patches.length, 1);
  const properties = patches[0].properties as Record<
    string,
    { rich_text?: Array<{ text: { content: string } }>; status?: unknown; url?: unknown }
  >;
  const postedIds = properties['Post ID'].rich_text?.[0].text.content || '';
  assert.ok(postedIds.length <= NOTION_RICH_TEXT_LIMIT);
  assert.notEqual(postedIds, ids);
  assert.equal(postedIds.includes('\n'), true);
  assert.equal(postedIds.endsWith('\n'), false);
  const originalLines = ids.split('\n');
  const postedLines = postedIds.split('\n');
  assert.ok(postedLines.length < originalLines.length);
  assert.deepEqual(postedLines, originalLines.slice(0, postedLines.length));
  assert.ok(properties['Postly Publish Status']);
  assert.ok(properties['Postly URL']);
  assert.ok(properties['Postly Plan']);
  assert.ok(properties['Status']);
});

test('queue and missing notes go to Postly Plan, not Post ID', async () => {
  const patches: Array<Record<string, unknown>> = [];
  globalThis.fetch = (async (_url, init) => {
    patches.push(JSON.parse(String(init?.body || '{}')));
    return new Response('{}', { status: 200 });
  }) as typeof fetch;

  await updatePostlyMetadata('page-queue', {
    postly_status: 'In progress',
    postly_plan: 'Auto queue started at 2026-10-30T00:00:00.000Z',
  });
  await updatePostlyMetadata('page-missing', {
    postly_status: 'Failed',
    final_status: 'Error',
    postly_plan: 'Missing: Caption; Image',
  });

  assert.equal(patches.length, 2);
  const queueProps = (patches[0].properties as Record<string, { rich_text?: unknown; status?: unknown }>);
  const missingProps = (patches[1].properties as Record<string, { rich_text?: unknown; status?: unknown }>);
  assert.equal(Object.prototype.hasOwnProperty.call(queueProps, 'Post ID'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(missingProps, 'Post ID'), false);
  assert.ok(queueProps['Postly Plan']);
  assert.ok(missingProps['Postly Plan']);
});

test('queue start and missing-content notes write Postly Plan in source', () => {
  const queue = fs.readFileSync(path.join(__dirname, 'postly-queue.service.ts'), 'utf8');
  const webhook = fs.readFileSync(path.join(__dirname, '../controllers/webhooks.controller.ts'), 'utf8');
  assert.match(queue, /postly_plan: `Auto queue started at/);
  assert.equal(queue.includes('post_id: `Auto queue started at'), false);
  assert.match(webhook, /postly_plan: `Missing:/);
  assert.equal(webhook.includes('post_id: `Missing:'), false);
});
