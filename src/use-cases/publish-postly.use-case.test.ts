import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { extractPostlyContent } from '../services/notion.service';
import { PostlyConnector } from '../connectors/legacy.connectors';
import { formatNetworkPlanLog } from '../services/postly-carousel';
import { buildPostlyPublishPayload, formatPostlyPublishLog } from './publish-postly.use-case';

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
  assert.equal(facebook?.settings?.share_as_carousel, false);
  assert.equal(facebook?.settings?.share_as_reel, false);
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
  const carousel = (
    result.payload as {
      carousel: { networks: Record<string, { status: string; reason: string; media: unknown[] }> };
    }
  ).carousel;
  assert.equal(carousel.networks.pinterest.status, 'accepted');
  assert.equal(carousel.networks.pinterest.media.length, 1);
  assert.equal(fetchCalls, 0);
});

test('lone video stays on IG FB Pinterest LinkedIn and sets share_as_reel', () => {
  const content = extractPostlyContent({
    Caption: { rich_text: [{ plain_text: 'one video' }] },
    'Instagram Caption': { rich_text: [{ plain_text: 'ig' }] },
    'Facebook Post': { rich_text: [{ plain_text: 'fb' }] },
    ...files('Video', [{ url: 'https://cdn.example/clip.mp4', name: 'clip.mp4' }]),
  });
  const payload = buildPostlyPublishPayload(content, [
    { identifier: 'instagram', id: 'ig-1' },
    { identifier: 'facebook', id: 'fb-1' },
    { identifier: 'pinterest', id: 'pin-1' },
    { identifier: 'linkedin', id: 'li-1' },
  ]);

  assert.deepEqual(
    payload.target_platforms.map(p => p.identifier),
    ['instagram', 'facebook', 'pinterest', 'linkedin']
  );
  const instagram = payload.platform_posts.find(p => p.identifier === 'instagram');
  const facebook = payload.platform_posts.find(p => p.identifier === 'facebook');
  assert.equal(instagram?.settings?.share_as_reel, true);
  assert.equal(facebook?.settings?.share_as_reel, true);
  assert.equal(facebook?.settings?.share_as_carousel, false);
  assert.equal(payload.plan.networks.pinterest.status, 'accepted');
  assert.equal(payload.plan.networks.linkedin.status, 'accepted');
});

test('Post ID log is network:id lines; plan stays on Postly Plan', () => {
  const content = extractPostlyContent({
    Caption: { rich_text: [{ plain_text: 'png only' }] },
    ...files('Image', [{ url: 'https://cdn.example/a.png', name: 'a.png' }]),
  });
  const payload = buildPostlyPublishPayload(content, [
    { identifier: 'instagram', id: 'ig-1' },
    { identifier: 'facebook', id: 'fb-1' },
  ]);
  assert.equal(payload.plan.networks.instagram.status, 'rejected');
  assert.equal(
    payload.target_platforms.map(p => p.identifier).includes('instagram'),
    false
  );
  const ids = formatPostlyPublishLog([
    { platform_name: 'facebook', status: 'published', external_id: 'fb-post' },
    { platform_name: 'instagram', status: 'failed', error: 'jpeg only' },
  ]);
  assert.equal(ids, 'facebook: fb-post\ninstagram: ERR: jpeg only');
  assert.equal(ids.includes('rejected:'), false);
  assert.equal(ids.includes('kept='), false);
  const plan = formatNetworkPlanLog(payload.plan);
  assert.match(plan, /instagram: rejected:instagram_jpeg_only kept=0/);
  assert.match(plan, /facebook: accepted:accepted kept=1/);
});

test('lone MOV is planned as video/quicktime Reel on Instagram', () => {
  const content = extractPostlyContent({
    Caption: { rich_text: [{ plain_text: 'mov' }] },
    'Instagram Caption': { rich_text: [{ plain_text: 'ig' }] },
    ...files('Video', [{ url: 'https://cdn.example/clip.mov', name: 'clip.mov' }]),
  });
  assert.equal(content.media_type, 'video/quicktime');
  const payload = buildPostlyPublishPayload(content, [{ identifier: 'instagram', id: 'ig-1' }]);
  assert.equal(payload.target_platforms.length, 1);
  assert.equal(payload.platform_posts[0].settings?.share_as_reel, true);
  assert.equal(payload.plan.networks.instagram.media[0].type, 'video/quicktime');
});
