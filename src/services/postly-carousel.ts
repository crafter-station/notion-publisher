/**
 * Shared carousel for every Postly network. Notion Image files are the slides.
 * Each network then accepts, trims, or rejects that same ordered set.
 */

import { PUBLISHER_PROPERTY_NAMES as PN } from '../config/schema';
import { createPropertyReader, NotionFileRef, NotionProps } from '../readers/props';
import { PostlyMedia } from './postly.service';

export type MediaSource = 'image' | 'gif' | 'video' | 'file' | 'screenshot';

export type MediaSlide = {
  index: number;
  url: string;
  type: string;
  name: string;
  source: MediaSource;
};

export type NetworkMediaStatus = 'accepted' | 'trimmed' | 'rejected';

export type PlannedMedia = {
  url: string;
  type: string;
  index: number;
};

export type DroppedMedia = PlannedMedia & { reason: string };

export type NetworkMediaPlan = {
  identifier: string;
  status: NetworkMediaStatus;
  reason: string;
  media: PlannedMedia[];
  dropped: DroppedMedia[];
  content_type?: 'regular' | 'document';
};

export type PostlyCarouselPlan = {
  slides: MediaSlide[];
  document?: MediaSlide;
  networks: Record<string, NetworkMediaPlan>;
};

export type NetworkMediaRule = {
  identifier: string;
  min: number;
  max: number;
  allowedTypes: readonly string[];
  jpegOnly?: boolean;
  exclusiveGifOrVideo?: boolean;
  documentPath?: boolean;
};

/** Limits from the 30-oct-2026 per-channel spec. Unlisted networks keep the full set. */
export const NETWORK_MEDIA_RULES: readonly NetworkMediaRule[] = [
  { identifier: 'instagram', min: 1, max: 20, allowedTypes: ['image/jpeg'], jpegOnly: true },
  {
    identifier: 'facebook',
    min: 1,
    max: 10,
    allowedTypes: ['image/jpeg', 'image/bmp', 'image/png', 'image/gif', 'image/tiff'],
  },
  {
    identifier: 'x',
    min: 1,
    max: 4,
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4'],
    exclusiveGifOrVideo: true,
  },
  { identifier: 'bluesky', min: 1, max: 4, allowedTypes: ['image/*', 'video/mp4'] },
  { identifier: 'pinterest', min: 2, max: 5, allowedTypes: ['image/png', 'image/jpeg'] },
  {
    identifier: 'linkedin',
    min: 1,
    max: 20,
    allowedTypes: ['image/jpeg', 'image/gif', 'image/png', 'application/pdf'],
    documentPath: true,
  },
];

const RULE_BY_ID = new Map(NETWORK_MEDIA_RULES.map(rule => [rule.identifier, rule]));

export function inferMediaType(name: string, url: string): string {
  const base = (name || basenameFromUrl(url)).split('?')[0].toLowerCase();
  if (base.endsWith('.jpg') || base.endsWith('.jpeg')) return 'image/jpeg';
  if (base.endsWith('.png')) return 'image/png';
  if (base.endsWith('.gif')) return 'image/gif';
  if (base.endsWith('.webp')) return 'image/webp';
  if (base.endsWith('.bmp')) return 'image/bmp';
  if (base.endsWith('.tif') || base.endsWith('.tiff')) return 'image/tiff';
  if (base.endsWith('.mp4')) return 'video/mp4';
  if (base.endsWith('.mov')) return 'video/mp4';
  if (base.endsWith('.pdf')) return 'application/pdf';
  return 'image/jpeg';
}

export function slideOrderKey(name: string, url: string): number | null {
  const base = (name || basenameFromUrl(url)).split('?')[0];
  const match = base.match(/^(\d{1,3})(?:[-_.\s]|$)/);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

export function orderMediaSlides(
  files: Array<NotionFileRef & { source: MediaSource; type?: string }>
): MediaSlide[] {
  const keyed = files.map((file, sourceIndex) => ({
    file,
    sourceIndex,
    orderKey: slideOrderKey(file.name, file.url),
  }));
  const numbered = keyed.some(item => item.orderKey !== null);
  const sorted = numbered
    ? keyed.slice().sort((a, b) => {
        const ak = a.orderKey ?? Number.MAX_SAFE_INTEGER;
        const bk = b.orderKey ?? Number.MAX_SAFE_INTEGER;
        if (ak !== bk) return ak - bk;
        return a.sourceIndex - b.sourceIndex;
      })
    : keyed;
  return sorted.map((item, index) => ({
    index,
    url: item.file.url,
    type: item.file.type || inferMediaType(item.file.name, item.file.url),
    name: item.file.name,
    source: item.file.source,
  }));
}

export function collectMediaFromProps(props: NotionProps): {
  slides: MediaSlide[];
  document?: MediaSlide;
} {
  const r = createPropertyReader(props);
  const images = r.files(PN.image).map(file => ({ ...file, source: 'image' as const }));
  const gifs = r.files(PN.gif).map(file => ({ ...file, source: 'gif' as const }));
  const videos = r.files(PN.video).map(file => ({ ...file, source: 'video' as const }));
  const screenshots = r.files(PN.screenshot).map(file => ({ ...file, source: 'screenshot' as const }));
  const documents = r
    .files(PN.file)
    .map(file => ({ ...file, source: 'file' as const, type: inferMediaType(file.name, file.url) }))
    .filter(file => file.type === 'application/pdf');

  type SourcedFile = NotionFileRef & { source: MediaSource };
  let raw: SourcedFile[] = images;
  if (images.length < 2) {
    if (videos.length) raw = videos;
    else if (gifs.length) raw = gifs;
    else if (images.length) raw = images;
    else raw = screenshots;
  }

  const slides = orderMediaSlides(raw);
  const document = documents[0]
    ? {
        index: 0,
        url: documents[0].url,
        type: 'application/pdf',
        name: documents[0].name,
        source: 'file' as const,
      }
    : undefined;
  return { slides, document };
}

export function planNetworkMedia(
  slides: MediaSlide[],
  document: MediaSlide | undefined,
  identifier: string
): NetworkMediaPlan {
  const rule = RULE_BY_ID.get(identifier);
  if (!rule) {
    return passThrough(identifier, slides, slides.length ? 'accepted' : 'rejected');
  }
  if (rule.documentPath && document) {
    return {
      identifier,
      status: 'accepted',
      reason: 'linkedin_document',
      media: [{ url: document.url, type: document.type, index: document.index }],
      dropped: slides.map(slide => ({
        url: slide.url,
        type: slide.type,
        index: slide.index,
        reason: 'linkedin_uses_document',
      })),
      content_type: 'document',
    };
  }

  const dropped: DroppedMedia[] = [];
  let working = slides.slice();

  if (rule.exclusiveGifOrVideo) {
    const exclusive = applyExclusiveGifOrVideo(working, dropped);
    if (exclusive.status === 'rejected') {
      return {
        identifier,
        status: 'rejected',
        reason: exclusive.reason,
        media: [],
        dropped,
      };
    }
    working = exclusive.media;
  }

  if (rule.jpegOnly) {
    working = keepMatching(working, dropped, slide => slide.type === 'image/jpeg', 'format_not_jpeg');
  } else {
    working = keepMatching(
      working,
      dropped,
      slide => typeAllowed(slide.type, rule.allowedTypes),
      'format_not_allowed'
    );
  }

  if (working.length === 0) {
    return {
      identifier,
      status: 'rejected',
      reason: slides.length === 0 ? 'no_media' : rule.jpegOnly ? 'instagram_jpeg_only' : 'no_allowed_media',
      media: [],
      dropped,
    };
  }

  if (working.length < rule.min) {
    return {
      identifier,
      status: 'rejected',
      reason: `below_min:${rule.min}`,
      media: [],
      dropped: [
        ...dropped,
        ...working.map(slide => ({
          url: slide.url,
          type: slide.type,
          index: slide.index,
          reason: `below_min:${rule.min}`,
        })),
      ],
    };
  }

  if (working.length > rule.max) {
    const kept = working.slice(0, rule.max);
    for (const slide of working.slice(rule.max)) {
      dropped.push({
        url: slide.url,
        type: slide.type,
        index: slide.index,
        reason: `over_max:${rule.max}`,
      });
    }
    return {
      identifier,
      status: 'trimmed',
      reason: `trimmed_to_max:${rule.max}`,
      media: toPlanned(kept),
      dropped,
      content_type: rule.documentPath ? 'regular' : undefined,
    };
  }

  const status: NetworkMediaStatus = dropped.length ? 'trimmed' : 'accepted';
  return {
    identifier,
    status,
    reason: status === 'trimmed' ? 'filtered_incompatible' : 'accepted',
    media: toPlanned(working),
    dropped,
    content_type: rule.documentPath ? 'regular' : undefined,
  };
}

export function carouselNetworkIds(extra: string[] = []): string[] {
  const ids = new Set<string>(NETWORK_MEDIA_RULES.map(rule => rule.identifier));
  for (const identifier of extra) ids.add(identifier);
  return [...ids];
}

export function planPostlyCarousel(
  slides: MediaSlide[],
  document: MediaSlide | undefined,
  identifiers: string[]
): PostlyCarouselPlan {
  const networks: Record<string, NetworkMediaPlan> = {};
  for (const identifier of identifiers) {
    networks[identifier] = planNetworkMedia(slides, document, identifier);
  }
  return { slides, document, networks };
}

export function slidesToPostlyMedia(slides: Array<{ url: string; type: string }>): PostlyMedia[] {
  return slides.map(slide => ({ url: slide.url, type: slide.type }));
}

function assertNetworkStatus(status: NetworkMediaStatus): NetworkMediaStatus {
  switch (status) {
    case 'accepted':
    case 'trimmed':
    case 'rejected':
      return status;
    default: {
      const _exhaustive: never = status;
      throw new Error(`unhandled network media status: ${_exhaustive}`);
    }
  }
}

function passThrough(
  identifier: string,
  slides: MediaSlide[],
  status: NetworkMediaStatus
): NetworkMediaPlan {
  return {
    identifier,
    status: assertNetworkStatus(status),
    reason: status === 'rejected' ? 'no_media' : 'accepted',
    media: toPlanned(slides),
    dropped: [],
  };
}

function applyExclusiveGifOrVideo(
  slides: MediaSlide[],
  dropped: DroppedMedia[]
): { status: 'ok' | 'rejected'; reason: string; media: MediaSlide[] } {
  const gifs = slides.filter(slide => slide.type === 'image/gif');
  const videos = slides.filter(slide => slide.type.startsWith('video/'));
  const photos = slides.filter(slide => slide.type !== 'image/gif' && !slide.type.startsWith('video/'));

  if (gifs.length && photos.length) {
    for (const slide of slides) {
      dropped.push({
        url: slide.url,
        type: slide.type,
        index: slide.index,
        reason: 'x_gif_exclusive',
      });
    }
    return { status: 'rejected', reason: 'x_gif_exclusive', media: [] };
  }
  if (videos.length && (photos.length || gifs.length)) {
    for (const slide of slides) {
      dropped.push({
        url: slide.url,
        type: slide.type,
        index: slide.index,
        reason: 'x_video_exclusive',
      });
    }
    return { status: 'rejected', reason: 'x_video_exclusive', media: [] };
  }
  if (gifs.length > 1) {
    dropped.push(
      ...gifs.slice(1).map(slide => ({
        url: slide.url,
        type: slide.type,
        index: slide.index,
        reason: 'x_gif_exclusive',
      }))
    );
    return { status: 'ok', reason: 'accepted', media: gifs.slice(0, 1) };
  }
  if (videos.length > 1) {
    dropped.push(
      ...videos.slice(1).map(slide => ({
        url: slide.url,
        type: slide.type,
        index: slide.index,
        reason: 'x_video_exclusive',
      }))
    );
    return { status: 'ok', reason: 'accepted', media: videos.slice(0, 1) };
  }
  return { status: 'ok', reason: 'accepted', media: slides };
}

function keepMatching(
  slides: MediaSlide[],
  dropped: DroppedMedia[],
  ok: (slide: MediaSlide) => boolean,
  reason: string
): MediaSlide[] {
  const kept: MediaSlide[] = [];
  for (const slide of slides) {
    if (ok(slide)) kept.push(slide);
    else dropped.push({ url: slide.url, type: slide.type, index: slide.index, reason });
  }
  return kept;
}

function typeAllowed(type: string, allowed: readonly string[]): boolean {
  return allowed.some(rule => {
    if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}

function toPlanned(slides: MediaSlide[]): PlannedMedia[] {
  return slides.map(slide => ({ url: slide.url, type: slide.type, index: slide.index }));
}

function basenameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const parts = path.split('/');
    return parts[parts.length - 1] || url;
  } catch {
    const parts = url.split('/');
    return parts[parts.length - 1] || url;
  }
}
