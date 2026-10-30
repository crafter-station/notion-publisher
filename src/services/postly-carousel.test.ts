import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractPostlyContent } from './notion.service';
import {
  collectMediaFromProps,
  CONSERVATIVE_NO_RULE_MAX,
  fileBasename,
  inferMediaType,
  orderMediaSlides,
  planNetworkMedia,
  planPostlyCarousel,
  UNKNOWN_EXTENSION_REASON,
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

test('Pinterest accepts 1 image as a pin and trims above 5', () => {
  const one = collectMediaFromProps({ ...files('Image', [jpeg(1)]) }).slides;
  const two = collectMediaFromProps({ ...files('Image', [jpeg(1), jpeg(2)]) }).slides;
  const six = collectMediaFromProps({
    ...files('Image', [jpeg(1), jpeg(2), jpeg(3), jpeg(4), jpeg(5), jpeg(6)]),
  }).slides;
  const pin = planNetworkMedia(one, undefined, 'pinterest');
  const carousel = planNetworkMedia(two, undefined, 'pinterest');
  const trimmed = planNetworkMedia(six, undefined, 'pinterest');
  assert.equal(pin.status, 'accepted');
  assert.equal(pin.media.length, 1);
  assert.equal(carousel.status, 'accepted');
  assert.equal(carousel.media.length, 2);
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

test('URL file names sort by decoded path basename, ignoring query', () => {
  const collected = collectMediaFromProps({
    ...files('Image', [
      { url: 'https://cdn.example/path/02-b.jpg?sig=zz', name: 'https://cdn.example/path/02-b.jpg?sig=zz' },
      { url: 'https://cdn.example/path/01-a.jpg?sig=aa', name: 'https://cdn.example/path/01-a.jpg?sig=aa' },
    ]),
  });
  assert.equal(fileBasename('https://cdn.example/path/02-b.jpg?sig=zz', 'https://cdn.example/path/02-b.jpg?sig=zz'), '02-b.jpg');
  assert.deepEqual(
    collected.slides.map(s => fileBasename(s.name, s.url)),
    ['01-a.jpg', '02-b.jpg']
  );
});

test('.mov is video/quicktime and unknown extensions are rejected', () => {
  assert.equal(inferMediaType('clip.mov', 'https://cdn.example/clip.mov'), 'video/quicktime');
  assert.equal(inferMediaType('file', 'https://cdn.example/file'), null);
  const collected = collectMediaFromProps({
    ...files('Image', [
      { url: 'https://cdn.example/file', name: 'file' },
      { url: 'https://cdn.example/ok.jpg', name: 'ok.jpg' },
    ]),
  });
  assert.equal(collected.slides.length, 1);
  assert.equal(collected.slides[0].type, 'image/jpeg');
  assert.equal(collected.unknown.length, 1);
  assert.equal(collected.unknown[0].reason, UNKNOWN_EXTENSION_REASON);
});

test('2+ images ignore video and GIF; 1 image + 1 video keeps the video', () => {
  const carouselWins = collectMediaFromProps({
    ...files('Image', [jpeg(1), jpeg(2)]),
    ...files('Video', [{ url: 'https://cdn.example/clip.mp4', name: 'clip.mp4' }]),
    ...files('GIF', [{ url: 'https://cdn.example/loop.gif', name: 'loop.gif' }]),
  });
  assert.deepEqual(
    carouselWins.slides.map(s => s.source),
    ['image', 'image']
  );

  const videoWins = collectMediaFromProps({
    ...files('Image', [jpeg(1)]),
    ...files('Video', [{ url: 'https://cdn.example/clip.mp4', name: 'clip.mp4' }]),
  });
  assert.equal(videoWins.slides.length, 1);
  assert.equal(videoWins.slides[0].type, 'video/mp4');
  assert.equal(videoWins.slides[0].source, 'video');
});

test('lone video is accepted on Instagram, Facebook, Pinterest and LinkedIn', () => {
  const slides = collectMediaFromProps({
    ...files('Video', [{ url: 'https://cdn.example/clip.mp4', name: 'clip.mp4' }]),
  }).slides;
  for (const identifier of ['instagram', 'facebook', 'pinterest', 'linkedin']) {
    const plan = planNetworkMedia(slides, undefined, identifier);
    assert.equal(plan.status, 'accepted', identifier);
    assert.equal(plan.media.length, 1, identifier);
    assert.equal(plan.media[0].type, 'video/mp4', identifier);
  }
});

test('Threads keeps JPEG/PNG carousel and drops GIF', () => {
  const slides = collectMediaFromProps({
    ...files('Image', [
      { url: 'https://cdn.example/01.jpg', name: '01.jpg' },
      { url: 'https://cdn.example/02.png', name: '02.png' },
      { url: 'https://cdn.example/03.gif', name: '03.gif' },
    ]),
  }).slides;
  const threads = planNetworkMedia(slides, undefined, 'threads');
  assert.equal(threads.status, 'trimmed');
  assert.deepEqual(
    threads.media.map(m => m.type),
    ['image/jpeg', 'image/png']
  );
  assert.equal(threads.dropped[0].reason, 'format_not_allowed');
});

test('TikTok photo accepts JPEG/WebP up to 35, rejects PNG/GIF, video goes alone', () => {
  const photos = collectMediaFromProps({
    ...files('Image', [
      { url: 'https://cdn.example/01.jpg', name: '01.jpg' },
      { url: 'https://cdn.example/02.webp', name: '02.webp' },
      { url: 'https://cdn.example/03.png', name: '03.png' },
    ]),
  }).slides;
  const photoPlan = planNetworkMedia(photos, undefined, 'tiktok');
  assert.equal(photoPlan.status, 'trimmed');
  assert.deepEqual(
    photoPlan.media.map(m => m.type),
    ['image/jpeg', 'image/webp']
  );

  const many = collectMediaFromProps({
    ...files(
      'Image',
      Array.from({ length: 36 }, (_, i) => jpeg(i + 1))
    ),
  }).slides;
  const trimmed = planNetworkMedia(many, undefined, 'tiktok');
  assert.equal(trimmed.status, 'trimmed');
  assert.equal(trimmed.reason, 'trimmed_to_max:35');
  assert.equal(trimmed.media.length, 35);

  const video = collectMediaFromProps({
    ...files('Video', [{ url: 'https://cdn.example/clip.mp4', name: 'clip.mp4' }]),
  }).slides;
  const videoPlan = planNetworkMedia(video, undefined, 'tiktok');
  assert.equal(videoPlan.status, 'accepted');
  assert.equal(videoPlan.media[0].type, 'video/mp4');
});

test('Telegram albums cap at 10 and GIF goes alone', () => {
  const album = collectMediaFromProps({
    ...files(
      'Image',
      Array.from({ length: 12 }, (_, i) => jpeg(i + 1))
    ),
  }).slides;
  const trimmed = planNetworkMedia(album, undefined, 'telegram');
  assert.equal(trimmed.status, 'trimmed');
  assert.equal(trimmed.reason, 'trimmed_to_max:10');
  assert.equal(trimmed.media.length, 10);

  const withGif = collectMediaFromProps({
    ...files('Image', [
      jpeg(1),
      { url: 'https://cdn.example/loop.gif', name: 'loop.gif' },
    ]),
  }).slides;
  const gifAlone = planNetworkMedia(withGif, undefined, 'telegram');
  assert.equal(gifAlone.status, 'trimmed');
  assert.equal(gifAlone.media.length, 1);
  assert.equal(gifAlone.media[0].type, 'image/gif');
  assert.equal(gifAlone.dropped.some(d => d.reason === 'gif_alone'), true);
});

test('WhatsApp and GBP keep one JPEG/PNG and reject GIF', () => {
  const two = collectMediaFromProps({ ...files('Image', [jpeg(1), jpeg(2)]) }).slides;
  const gif = collectMediaFromProps({
    ...files('Image', [{ url: 'https://cdn.example/loop.gif', name: 'loop.gif' }]),
  }).slides;
  for (const identifier of ['whatsapp', 'googleMyBusiness']) {
    const trimmed = planNetworkMedia(two, undefined, identifier);
    assert.equal(trimmed.status, 'trimmed', identifier);
    assert.equal(trimmed.reason, 'trimmed_to_max:1', identifier);
    assert.equal(trimmed.media.length, 1, identifier);
    const rejected = planNetworkMedia(gif, undefined, identifier);
    assert.equal(rejected.status, 'rejected', identifier);
    assert.equal(rejected.reason, 'no_allowed_media', identifier);
  }
});

test('networks without a rule use a conservative cap reported as no_rule', () => {
  const slides = collectMediaFromProps({
    ...files(
      'Image',
      Array.from({ length: 25 }, (_, i) => jpeg(i + 1))
    ),
  }).slides;
  assert.equal(slides.length, 25);
  const youtube = planNetworkMedia(slides, undefined, 'youtube');
  assert.equal(youtube.status, 'trimmed');
  assert.equal(youtube.reason, 'no_rule');
  assert.equal(youtube.media.length, CONSERVATIVE_NO_RULE_MAX);
  assert.equal(youtube.dropped.every(d => d.reason === 'no_rule'), true);
  const wordpress = planNetworkMedia(slides, undefined, 'wordpress');
  assert.equal(wordpress.reason, 'no_rule');
  assert.equal(wordpress.media.length, CONSERVATIVE_NO_RULE_MAX);
});
