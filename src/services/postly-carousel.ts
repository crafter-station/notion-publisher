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
  unknown: DroppedMedia[];
  networks: Record<string, NetworkMediaPlan>;
};

export type NetworkMediaRule = {
  identifier: string;
  min: number;
  max: number;
  allowedTypes: readonly string[];
  jpegOnly?: boolean;
  exclusiveGifOrVideo?: boolean;
  exclusiveGif?: boolean;
  videoAlone?: boolean;
  documentPath?: boolean;
};

/** Unlisted networks never get an unlimited set; extras are trimmed with reason no_rule. */
export const CONSERVATIVE_NO_RULE_MAX = 4;

export const UNKNOWN_EXTENSION_REASON = 'unknown_extension';

/** Limits from the 30-oct-2026 per-channel spec. */
export const NETWORK_MEDIA_RULES: readonly NetworkMediaRule[] = [
  {
    identifier: 'instagram',
    min: 1,
    max: 20,
    allowedTypes: ['image/jpeg', 'video/mp4', 'video/quicktime'],
    jpegOnly: true,
  },
  {
    identifier: 'facebook',
    min: 1,
    max: 10,
    allowedTypes: [
      'image/jpeg',
      'image/bmp',
      'image/png',
      'image/gif',
      'image/tiff',
      'video/mp4',
      'video/quicktime',
    ],
    videoAlone: true,
  },
  {
    identifier: 'x',
    min: 1,
    max: 4,
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime'],
    exclusiveGifOrVideo: true,
  },
  {
    identifier: 'bluesky',
    min: 1,
    max: 4,
    allowedTypes: ['image/*', 'video/mp4', 'video/quicktime'],
    videoAlone: true,
  },
  {
    identifier: 'pinterest',
    min: 1,
    max: 5,
    allowedTypes: ['image/png', 'image/jpeg', 'video/mp4', 'video/quicktime'],
    videoAlone: true,
  },
  {
    identifier: 'linkedin',
    min: 1,
    max: 20,
    allowedTypes: ['image/jpeg', 'image/gif', 'image/png', 'application/pdf', 'video/mp4', 'video/quicktime'],
    documentPath: true,
    videoAlone: true,
  },
  {
    identifier: 'threads',
    min: 1,
    max: 20,
    allowedTypes: ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime'],
  },
  {
    identifier: 'tiktok',
    min: 1,
    max: 35,
    allowedTypes: ['image/jpeg', 'image/webp', 'video/mp4', 'video/quicktime'],
    videoAlone: true,
  },
  {
    identifier: 'telegram',
    min: 1,
    max: 10,
    allowedTypes: ['image/*', 'video/*', 'image/gif'],
    exclusiveGif: true,
  },
  {
    identifier: 'whatsapp',
    min: 1,
    max: 1,
    allowedTypes: ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime'],
    videoAlone: true,
  },
  {
    identifier: 'googleMyBusiness',
    min: 1,
    max: 1,
    allowedTypes: ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime'],
    videoAlone: true,
  },
];

const RULE_BY_ID = new Map(NETWORK_MEDIA_RULES.map(rule => [rule.identifier, rule]));

const EXTENSION_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
};

export function isVideoType(type: string | undefined): boolean {
  return typeof type === 'string' && type.startsWith('video/');
}

/** Decoded last path segment. Works when Notion stores the URL as the file name. */
export function fileBasename(name: string, url: string): string {
  return basenameFromUrl(name || url || '');
}

export function inferMediaType(name: string, url: string): string | null {
  const base = fileBasename(name, url).toLowerCase();
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return null;
  const ext = base.slice(dot + 1);
  return EXTENSION_TYPES[ext] || null;
}

export function slideOrderKey(name: string, url: string): number | null {
  const base = fileBasename(name, url);
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
    type: item.file.type || inferMediaType(item.file.name, item.file.url) || '',
    name: item.file.name,
    source: item.file.source,
  }));
}

export function collectMediaFromProps(props: NotionProps): {
  slides: MediaSlide[];
  document?: MediaSlide;
  unknown: DroppedMedia[];
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
  // Selection: 2+ images ignore video/GIF. 1 image + 1 video → video wins.
  // 1 image + GIF (no video) → GIF. 0 images → video, else GIF, else screenshot.
  let raw: SourcedFile[] = images;
  if (images.length < 2) {
    if (videos.length) raw = videos;
    else if (gifs.length) raw = gifs;
    else if (images.length) raw = images;
    else raw = screenshots;
  }

  const { accepted, unknown } = classifyFiles(raw);
  const slides = orderMediaSlides(accepted);
  const document = documents[0]
    ? {
        index: 0,
        url: documents[0].url,
        type: 'application/pdf',
        name: documents[0].name,
        source: 'file' as const,
      }
    : undefined;
  return { slides, document, unknown };
}

export function planNetworkMedia(
  slides: MediaSlide[],
  document: MediaSlide | undefined,
  identifier: string
): NetworkMediaPlan {
  const rule = RULE_BY_ID.get(identifier);
  if (!rule) {
    return applyConservativeNoRule(identifier, slides);
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

  if (rule.exclusiveGif) {
    working = applyExclusiveGif(working, dropped);
  }

  if (rule.jpegOnly) {
    working = keepMatching(
      working,
      dropped,
      slide => slide.type === 'image/jpeg' || typeAllowed(slide.type, rule.allowedTypes.filter(isVideoType)),
      'format_not_jpeg'
    );
  } else {
    working = keepMatching(
      working,
      dropped,
      slide => typeAllowed(slide.type, rule.allowedTypes),
      'format_not_allowed'
    );
  }

  if (rule.videoAlone) {
    working = applyVideoAlone(working, dropped);
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
  identifiers: string[],
  unknown: DroppedMedia[] = []
): PostlyCarouselPlan {
  const networks: Record<string, NetworkMediaPlan> = {};
  for (const identifier of identifiers) {
    networks[identifier] = applyUnknownDrops(planNetworkMedia(slides, document, identifier), unknown);
  }
  return { slides, document, unknown, networks };
}

export function slidesToPostlyMedia(slides: Array<{ url: string; type: string }>): PostlyMedia[] {
  return slides.map(slide => ({ url: slide.url, type: slide.type }));
}

export function formatNetworkPlanLog(plan: PostlyCarouselPlan): string {
  const lines: string[] = [];
  if (plan.unknown.length) {
    lines.push(`unknown: rejected:${UNKNOWN_EXTENSION_REASON} count=${plan.unknown.length}`);
  }
  for (const network of Object.values(plan.networks)) {
    lines.push(
      `${network.identifier}: ${network.status}:${network.reason} kept=${network.media.length}`
    );
  }
  return lines.join('\n');
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

function applyConservativeNoRule(identifier: string, slides: MediaSlide[]): NetworkMediaPlan {
  if (!slides.length) {
    return {
      identifier,
      status: assertNetworkStatus('rejected'),
      reason: 'no_media',
      media: [],
      dropped: [],
    };
  }
  if (slides.length > CONSERVATIVE_NO_RULE_MAX) {
    const kept = slides.slice(0, CONSERVATIVE_NO_RULE_MAX);
    return {
      identifier,
      status: 'trimmed',
      reason: 'no_rule',
      media: toPlanned(kept),
      dropped: slides.slice(CONSERVATIVE_NO_RULE_MAX).map(slide => ({
        url: slide.url,
        type: slide.type,
        index: slide.index,
        reason: 'no_rule',
      })),
    };
  }
  return {
    identifier,
    status: 'accepted',
    reason: 'accepted',
    media: toPlanned(slides),
    dropped: [],
  };
}

function applyExclusiveGifOrVideo(
  slides: MediaSlide[],
  dropped: DroppedMedia[]
): { status: 'ok' | 'rejected'; reason: string; media: MediaSlide[] } {
  const gifs = slides.filter(slide => slide.type === 'image/gif');
  const videos = slides.filter(slide => isVideoType(slide.type));
  const photos = slides.filter(slide => slide.type !== 'image/gif' && !isVideoType(slide.type));

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

function applyExclusiveGif(slides: MediaSlide[], dropped: DroppedMedia[]): MediaSlide[] {
  const gifs = slides.filter(slide => slide.type === 'image/gif');
  if (!gifs.length) return slides;

  const album = slides.filter(slide => slide.type !== 'image/gif');
  if (album.length) {
    for (const slide of gifs) {
      dropped.push({
        url: slide.url,
        type: slide.type,
        index: slide.index,
        reason: 'gif_not_in_album',
      });
    }
    return album;
  }

  const kept = gifs.slice(0, 1);
  for (const slide of gifs.slice(1)) {
    dropped.push({
      url: slide.url,
      type: slide.type,
      index: slide.index,
      reason: 'gif_alone',
    });
  }
  return kept;
}

function applyUnknownDrops(plan: NetworkMediaPlan, unknown: DroppedMedia[]): NetworkMediaPlan {
  if (!unknown.length) return plan;
  plan.dropped = [...unknown, ...plan.dropped];
  if (plan.status === 'accepted') {
    plan.status = 'trimmed';
    plan.reason = UNKNOWN_EXTENSION_REASON;
  }
  return plan;
}

function applyVideoAlone(slides: MediaSlide[], dropped: DroppedMedia[]): MediaSlide[] {
  const videos = slides.filter(slide => isVideoType(slide.type));
  if (!videos.length) return slides;
  const kept = videos.slice(0, 1);
  for (const slide of slides) {
    if (slide === kept[0]) continue;
    dropped.push({
      url: slide.url,
      type: slide.type,
      index: slide.index,
      reason: 'video_alone',
    });
  }
  return kept;
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

function classifyFiles(
  files: Array<NotionFileRef & { source: MediaSource; type?: string }>
): {
  accepted: Array<NotionFileRef & { source: MediaSource; type: string }>;
  unknown: DroppedMedia[];
} {
  const accepted: Array<NotionFileRef & { source: MediaSource; type: string }> = [];
  const unknown: DroppedMedia[] = [];
  files.forEach((file, index) => {
    const type = file.type || inferMediaType(file.name, file.url);
    if (!type) {
      unknown.push({
        url: file.url,
        type: '',
        index,
        reason: UNKNOWN_EXTENSION_REASON,
      });
      return;
    }
    accepted.push({ ...file, type });
  });
  return { accepted, unknown };
}

function basenameFromUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const path = new URL(trimmed).pathname;
    const last = path.split('/').filter(Boolean).pop() || '';
    return decodeURIComponent(last);
  } catch {
    const withoutQuery = trimmed.split('#')[0].split('?')[0];
    const last = withoutQuery.split('/').filter(Boolean).pop() || withoutQuery;
    try {
      return decodeURIComponent(last);
    } catch {
      return last;
    }
  }
}
