import { POSTLY_PLATFORM_CATALOG } from '../services/postly-platforms.catalog';
import { DistributorCapability } from './types';

/**
 * Distributors by layer:
 * - Products: gumroad (live), myskool (discover)
 * - Social: postly (live), postiz (stub), typefully (stub)
 * - Music: once (stub)
 * - Events: luma (stub)
 */
export const DISTRIBUTORS: DistributorCapability[] = [
  {
    id: 'gumroad',
    kind: 'marketplace',
    status: 'live',
    envKeys: ['GUMROAD_TOKEN'],
    notes: 'Products layer. Digital storefront: draft/create/upload/publish/unpublish + autopilot.',
  },
  {
    id: 'myskool',
    kind: 'community',
    status: 'discover',
    envKeys: ['SKOOL_API_KEY', 'SKOOL_GROUP_ID'],
    notes:
      'Products/community layer via MySkool (https://api.myskool.xyz/v1). Read groups/posts/comments. Create post still upstream Phase 2 — no publish webhook.',
  },
  {
    id: 'postly',
    kind: 'social',
    status: 'live',
    envKeys: ['POSTLY_API_KEY', 'POSTLY_WORKSPACE_ID', 'POSTLY_TARGET_PLATFORMS'],
    notes:
      'Social layer. Multi-channel + audience groups. Optional POSTLY_AUDIENCE_GROUP unused by default publish.',
  },
  {
    id: 'postiz',
    kind: 'social',
    status: 'stub',
    envKeys: ['POSTIZ_API_KEY'],
    notes: 'Social layer. Alternate multi-platform scheduler. Mapped only — wire when account ready.',
  },
  {
    id: 'typefully',
    kind: 'social',
    status: 'stub',
    envKeys: ['TYPEFULLY_API_KEY'],
    notes:
      'Social layer. X/Twitter drafts & threads. Complements Postly (audience group name "Postly + Typefully").',
  },
  {
    id: 'once',
    kind: 'music',
    status: 'stub',
    envKeys: ['ONCE_API_KEY'],
    notes: 'Music layer (ONCE.app). DSP distribution. Mapped only.',
  },
  {
    id: 'luma',
    kind: 'other',
    status: 'stub',
    envKeys: ['LUMA_API_KEY'],
    notes: 'Events layer (Luma / lu.ma). Mapped only — wire when account ready.',
  },
];

export function listDistributors(): DistributorCapability[] {
  return DISTRIBUTORS.slice();
}

export function getDistributor(id: string): DistributorCapability | undefined {
  return DISTRIBUTORS.find(d => d.id === id);
}

export function getCapabilitiesSnapshot() {
  return {
    intent:
      'Notion CMS orchestrator — products (Gumroad, Skool), social (Postly, Postiz, Typefully), music (ONCE.app), events (Luma)',
    layers: {
      products: ['gumroad', 'myskool'],
      social: ['postly', 'postiz', 'typefully'],
      music: ['once'],
      events: ['luma'],
    },
    distributors: listDistributors(),
    postly_platforms: POSTLY_PLATFORM_CATALOG,
  };
}

/** Throws if registry invariants break. */
export function checkRegistryHealthy(): void {
  if (DISTRIBUTORS.length < 7) throw new Error('expected at least 7 distributors');
  const ids = new Set<string>();
  for (const d of DISTRIBUTORS) {
    if (!d.id) throw new Error('distributor missing id');
    if (ids.has(d.id)) throw new Error(`duplicate distributor id: ${d.id}`);
    ids.add(d.id);
    if (!['marketplace', 'social', 'community', 'music', 'other'].includes(d.kind)) {
      throw new Error(`bad kind: ${d.id}`);
    }
    if (!['live', 'discover', 'stub'].includes(d.status)) {
      throw new Error(`bad status: ${d.id}`);
    }
    if (!Array.isArray(d.envKeys)) throw new Error(`envKeys must be array: ${d.id}`);
    if (!d.notes.trim()) throw new Error(`notes required: ${d.id}`);
  }
  if (getDistributor('gumroad')?.status !== 'live') throw new Error('gumroad must be live');
  if (getDistributor('postly')?.status !== 'live') throw new Error('postly must be live');
  if (getDistributor('myskool')?.status !== 'discover') throw new Error('myskool must be discover');
  if (!getDistributor('postiz')) throw new Error('postiz stub missing');
  if (!getDistributor('once')) throw new Error('once stub missing');
  if (!getDistributor('luma')) throw new Error('luma stub missing');
  if (getDistributor('nce') || getDistributor('postis')) {
    throw new Error('legacy nce/postis ids must be removed');
  }
  if (!POSTLY_PLATFORM_CATALOG.some(p => p.identifier === 'bluesky')) throw new Error('catalog missing bluesky');
  if (!POSTLY_PLATFORM_CATALOG.some(p => p.identifier === 'telegram')) throw new Error('catalog missing telegram');
  if (!POSTLY_PLATFORM_CATALOG.some(p => p.identifier === 'x')) throw new Error('catalog missing x');
  if (POSTLY_PLATFORM_CATALOG.find(p => p.identifier === 'reddit')?.availability !== 'docs_only') {
    throw new Error('reddit must be docs_only');
  }
}
