import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractPostlyContent } from './notion.service';
import {
  collectMediaFromProps,
  orderMediaSlides,
  planNetworkMedia,
  planPostlyCarousel,
} from './postly-carousel';

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

function jpeg(index: number, name?: string) {
  const file = name || `${String(index).padStart(2, '0')}-slide.jpg`;
  return { url: `https://cdn.example/${file}`, name: file };
}

function captionProps() {
  return {
    Caption: { rich_text: [{ plain_text: 'hello carousel' }] },
  };
}

test('Notion Image files keep array order when names have no numeric prefix', () => {
  const slides = orderMediaSlides([
    { url: 'https://cdn.example/hook.jpg', name: 'hook.jpg', source: 'image' },
    { url: 'https://cdn.example/body.jpg', name: 'body.jpg', source: 'image' },
    { url: 'https://cdn.example/cta.jpg', name: 'cta.jpg', source: 'image' },
  ]);
  assert.deepEqual(
    slides.map(s => s.name),
    ['hook.jpg', 'body.jpg', 'cta.jpg']
  );
  assert.deepEqual(
    slides.map(s => s.index),
    [0, 1, 2]
  );
});

test('numeric filename prefixes reorder slides deterministically', () => {
  const collected = collectMediaFromProps({
    ...files('Image', [
      { url: 'https://cdn.example/c.jpg', name: '03-cta.jpg' },
      { url: 'https://cdn.example/a.jpg', name: '01-hook.jpg' },
      { url: 'https://cdn.example/b.jpg', name: '02-body.jpg' },
    ]),
  });
  assert.deepEqual(
    collected.slides.map(s => s.name),
    ['01-hook.jpg', '02-body.jpg', '03-cta.jpg']
  );
  assert.equal(collected.slides[0].index, 0);
  assert.equal(collected.slides[2].index, 2);
});

test('same numeric sort is stable across shuffled input', () => {
  const a = collectMediaFromProps({
    ...files('Image', [jpeg(3), jpeg(1), jpeg(2), jpeg(4)]),
  });
  const b = collectMediaFromProps({
    ...files('Image', [jpeg(4), jpeg(2), jpeg(1), jpeg(3)]),
  });
  assert.deepEqual(
    a.slides.map(s => s.name),
    b.slides.map(s => s.name)
  );
  assert.deepEqual(
    a.slides.map(s => s.url),
    [
      'https://cdn.example/01-slide.jpg',
      'https://cdn.example/02-slide.jpg',
      'https://cdn.example/03-slide.jpg',
      'https://cdn.example/04-slide.jpg',
    ]
  );
});

test('X and Bluesky trim to 4 and keep slide order', () => {
  const slides = collectMediaFromProps({
    ...files('Image', [jpeg(1), jpeg(2), jpeg(3), jpeg(4), jpeg(5), jpeg(6)]),
  }).slides;
  const x = planNetworkMedia(slides, undefined, 'x');
  const bsky = planNetworkMedia(slides, undefined, 'bluesky');
  assert.equal(x.status, 'trimmed');
  assert.equal(x.reason, 'trimmed_to_max:4');
  assert.deepEqual(
    x.media.map(m => m.index),
    [0, 1, 2, 3]
  );
  assert.equal(x.dropped.length, 2);
  assert.equal(bsky.status, 'trimmed');
  assert.equal(bsky.reason, 'trimmed_to_max:4');
  assert.equal(bsky.media.length, 4);
});

test('Pinterest rejects 1 slide and trims above 5', () => {
  const one = collectMediaFromProps({ ...files('Image', [jpeg(1)]) }).slides;
  const six = collectMediaFromProps({
    ...files('Image', [jpeg(1), jpeg(2), jpeg(3), jpeg(4), jpeg(5), jpeg(6)]),
  }).slides;
  const rejected = planNetworkMedia(one, undefined, 'pinterest');
  const trimmed = planNetworkMedia(six, undefined, 'pinterest');
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.reason, 'below_min:2');
  assert.equal(rejected.media.length, 0);
  assert.equal(trimmed.status, 'trimmed');
  assert.equal(trimmed.reason, 'trimmed_to_max:5');
  assert.equal(trimmed.media.length, 5);
});

test('Instagram keeps JPEG only and rejects a PNG-only set', () => {
  const mixed = collectMediaFromProps({
    ...files('Image', [
      { url: 'https://cdn.example/01.jpg', name: '01.jpg' },
      { url: 'https://cdn.example/02.png', name: '02.png' },
      { url: 'https://cdn.example/03.jpeg', name: '03.jpeg' },
    ]),
  }).slides;
  const pngOnly = collectMediaFromProps({
    ...files('Image', [{ url: 'https://cdn.example/a.png', name: 'a.png' }]),
  }).slides;
  const trimmed = planNetworkMedia(mixed, undefined, 'instagram');
  const rejected = planNetworkMedia(pngOnly, undefined, 'instagram');
  assert.equal(trimmed.status, 'trimmed');
  assert.deepEqual(
    trimmed.media.map(m => m.type),
    ['image/jpeg', 'image/jpeg']
  );
  assert.equal(trimmed.dropped[0].reason, 'format_not_jpeg');
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.reason, 'instagram_jpeg_only');
});

test('Facebook trims to 10', () => {
  const slides = collectMediaFromProps({
    ...files(
      'Image',
      Array.from({ length: 12 }, (_, i) => jpeg(i + 1))
    ),
  }).slides;
  const facebook = planNetworkMedia(slides, undefined, 'facebook');
  assert.equal(facebook.status, 'trimmed');
  assert.equal(facebook.reason, 'trimmed_to_max:10');
  assert.equal(facebook.media.length, 10);
  assert.equal(facebook.dropped.length, 2);
});

test('LinkedIn uses the File PDF as content_type document', () => {
  const collected = collectMediaFromProps({
    ...files('Image', [jpeg(1), jpeg(2)]),
    ...files('File', [{ url: 'https://cdn.example/deck.pdf', name: 'deck.pdf' }]),
  });
  const linkedin = planNetworkMedia(collected.slides, collected.document, 'linkedin');
  assert.equal(linkedin.status, 'accepted');
  assert.equal(linkedin.reason, 'linkedin_document');
  assert.equal(linkedin.content_type, 'document');
  assert.deepEqual(linkedin.media, [
    { url: 'https://cdn.example/deck.pdf', type: 'application/pdf', index: 0 },
  ]);
  assert.equal(linkedin.dropped.length, 2);
});

test('the same ordered set is planned for every requested network', () => {
  const slides = collectMediaFromProps({
    ...files('Image', [jpeg(1), jpeg(2), jpeg(3), jpeg(4), jpeg(5)]),
  }).slides;
  const plan = planPostlyCarousel(slides, undefined, [
    'instagram',
    'facebook',
    'linkedin',
    'x',
    'pinterest',
    'bluesky',
    'threads',
  ]);
  assert.equal(plan.slides.length, 5);
  assert.equal(plan.networks.instagram.status, 'accepted');
  assert.equal(plan.networks.facebook.status, 'accepted');
  assert.equal(plan.networks.linkedin.status, 'accepted');
  assert.equal(plan.networks.linkedin.content_type, 'regular');
  assert.equal(plan.networks.x.status, 'trimmed');
  assert.equal(plan.networks.pinterest.status, 'accepted');
  assert.equal(plan.networks.bluesky.status, 'trimmed');
  assert.equal(plan.networks.threads.status, 'accepted');
  assert.deepEqual(
    plan.networks.instagram.media.map(m => m.index),
    [0, 1, 2, 3, 4]
  );
});

test('X rejects a GIF mixed with photos', () => {
  const slides = collectMediaFromProps({
    ...files('Image', [
      { url: 'https://cdn.example/01.jpg', name: '01.jpg' },
      { url: 'https://cdn.example/02.gif', name: '02.gif' },
    ]),
  }).slides;
  const x = planNetworkMedia(slides, undefined, 'x');
  assert.equal(x.status, 'rejected');
  assert.equal(x.reason, 'x_gif_exclusive');
});

test('extractPostlyContent reads every Image file into media[]', () => {
  const content = extractPostlyContent({
    ...captionProps(),
    ...files('Image', [jpeg(2), jpeg(1), jpeg(3)]),
  });
  assert.equal(content.is_complete, true);
  assert.equal(content.media.length, 3);
  assert.deepEqual(
    content.media.map(s => s.name),
    ['01-slide.jpg', '02-slide.jpg', '03-slide.jpg']
  );
  assert.equal(content.media_url, 'https://cdn.example/01-slide.jpg');
  assert.equal(content.document, undefined);
});
