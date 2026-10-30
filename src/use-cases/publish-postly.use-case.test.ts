import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { extractPostlyContent } from '../services/notion.service';
import { PostlyConnector } from '../connectors/legacy.connectors';
import { buildPostlyPublishPayload } from './publish-postly.use-case';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function files(name: string, items: Array<{ url: string; name?: string }>) {
  return {
    [name]: {
      files: items.map(item => ({
        type: 'external',
        name: item.name || item.url,
        external: { url: item.url },
      })),
    },
  };
}

function jpeg(n: number) {
  const name = `${String(n).padStart(2, '0')}-slide.jpg`;
  return { url: `https://cdn.example/${name}`, name };
}

function contentWithCarousel() {
  return extractPostlyContent({
    Caption: { rich_text: [{ plain_text: 'carousel copy' }] },
    'Instagram Caption': { rich_text: [{ plain_text: 'ig' }] },
    'Facebook Post': { rich_text: [{ plain_text: 'fb' }] },
    'LinkedIn Post': { rich_text: [{ plain_text: 'li' }] },
    ...files('Image', [jpeg(1), jpeg(2), jpeg(3), jpeg(4), jpeg(5)]),
    ...files('File', [{ url: 'https://cdn.example/deck.pdf', name: 'deck.pdf' }]),
  });
}

test('dry-run payload plans the carousel and never calls fetch', async () => {
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error('provider fetch must not run');
  }) as typeof fetch;

  const content = contentWithCarousel();
  const payload = buildPostlyPublishPayload(content, [
    { identifier: 'instagram', id: 'ig-1' },
    { identifier: 'facebook', id: 'fb-1' },
    { identifier: 'linkedin', id: 'li-1' },
    { identifier: 'x', id: 'x-1' },
    { identifier: 'pinterest', id: 'pin-1' },
    { identifier: 'bluesky', id: 'bsky-1' },
  ]);

  assert.equal(payload.media.length, 5);
  assert.equal(payload.plan.networks.x.status, 'trimmed');
  assert.equal(payload.plan.networks.bluesky.status, 'trimmed');
  assert.equal(payload.plan.networks.linkedin.content_type, 'document');
  const linkedin = payload.platform_posts.find(p => p.identifier === 'linkedin');
  assert.equal(linkedin?.settings?.content_type, 'document');
  assert.deepEqual(linkedin?.media_override, [
    { url: 'https://cdn.example/deck.pdf', type: 'application/pdf' },
  ]);
  const facebook = payload.platform_posts.find(p => p.identifier === 'facebook');
  assert.equal(facebook?.settings?.share_as_carousel, true);
  assert.equal(fetchCalls, 0);
});

test('PostlyConnector dry-run returns trimmed/rejected reasons and does not fetch', async () => {
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error('provider fetch must not run');
  }) as typeof fetch;

  const connector = new PostlyConnector();
  const result = await connector.publish(
    {
      properties: {
        Caption: { rich_text: [{ plain_text: 'one slide' }] },
        ...files('Image', [jpeg(1)]),
      },
    },
    { dryRun: true }
  );

  assert.equal(result.dry_run, true);
  assert.equal(result.called_publish, false);
  const carousel = (result.payload as { carousel: { networks: Record<string, { status: string; reason: string }> } })
    .carousel;
  assert.equal(carousel.networks.pinterest.status, 'rejected');
  assert.equal(carousel.networks.pinterest.reason, 'below_min:2');
  assert.equal(fetchCalls, 0);
});
