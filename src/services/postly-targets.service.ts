import { env } from '../config/env';
import { PostlyTargetPlatform } from './postly.service';

const knownPostlyPlatformIds: Record<string, string> = {
  '10045131488904663': 'instagram',
  '730157560180777': 'facebook',
  '98388542': 'linkedin',
  '891290651194686446': 'pinterest',
  '891290651194686441': 'pinterest',
  '35535330302781477': 'threads',
  'fba637c7-08d9-5f27-970e-6112077f590d': 'tiktok',
  'UC7DghILGdjZcovZJo6l9mqg': 'youtube',
};

const legacyPlatformOrder = [
  'instagram',
  'facebook',
  'linkedin',
  'pinterest',
  'pinterest',
  'threads',
  'tiktok',
  'youtube',
];

export function parsePostlyTargetPlatforms(raw: string): PostlyTargetPlatform[] {
  const entries = raw.split(',').map(p => p.trim()).filter(Boolean);

  return entries.map((entry, index) => {
    const explicit = entry.match(/^([a-z_]+):(.+)$/i);
    if (explicit) {
      return { identifier: explicit[1].toLowerCase(), id: explicit[2].trim() };
    }

    const identifier = knownPostlyPlatformIds[entry] || legacyPlatformOrder[index];
    if (!identifier) {
      throw new Error(`Cannot infer Postly platform identifier for target "${entry}". Use "identifier:id" in POSTLY_TARGET_PLATFORMS.`);
    }

    return { identifier, id: entry };
  });
}

export function resolveDefaultPostlyTargetPlatforms() {
  return parsePostlyTargetPlatforms(env.POSTLY_TARGET_PLATFORMS);
}
