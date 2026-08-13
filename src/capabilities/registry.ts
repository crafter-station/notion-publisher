import { POSTLY_PLATFORM_CATALOG } from '../services/postly-platforms.catalog';
import { DistributorCapability } from './types';

export const DISTRIBUTORS: DistributorCapability[] = [
  {
    id: 'gumroad',
    kind: 'marketplace',
    status: 'live',
    envKeys: ['GUMROAD_TOKEN'],
    notes: 'Product create/publish/unpublish via Notion webhooks + optional autopilot.',
  },
  {
    id: 'postly',
    kind: 'social',
    status: 'live',
    envKeys: ['POSTLY_API_KEY', 'POSTLY_WORKSPACE_ID', 'POSTLY_TARGET_PLATFORMS'],
    notes:
      'Multi-channel social publish. Optional POSTLY_AUDIENCE_GROUP (unused by default). Discover socials + audience groups via GET /capabilities/postly.',
  },
  {
    id: 'myskool',
    kind: 'community',
    status: 'stub',
    envKeys: ['SKOOL_API_KEY'],
    notes:
      'MySkool unofficial Skool API (https://api.myskool.xyz/v1). Read groups/posts/comments live upstream; create post still Phase 2. Not wired.',
  },
  {
    id: 'typefully',
    kind: 'social',
    status: 'stub',
    envKeys: ['TYPEFULLY_API_KEY'],
    notes:
      'External X/Twitter path. Not part of Postly. Audience group name "GPT Chain - Postly + Typefully" means X stays on Typefully.',
  },
  {
    id: 'nce',
    kind: 'music',
    status: 'stub',
    envKeys: ['NCE_API_KEY'],
    notes: 'Music distribution (planned). Placeholder only.',
  },
  {
    id: 'postis',
    kind: 'other',
    status: 'stub',
    envKeys: ['POSTIS_API_KEY'],
    notes: 'Future distribution connector (planned). Placeholder only.',
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
    intent: 'portable publisher kit — new channels are capability-only until opted in',
    distributors: listDistributors(),
    postly_platforms: POSTLY_PLATFORM_CATALOG,
  };
}

/** Throws if registry invariants break. */
export function checkRegistryHealthy(): void {
  if (DISTRIBUTORS.length < 6) throw new Error('expected at least 6 distributors');
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
  if (getDistributor('myskool')?.status !== 'stub') throw new Error('myskool must be stub');
  if (!POSTLY_PLATFORM_CATALOG.some(p => p.identifier === 'bluesky')) throw new Error('catalog missing bluesky');
  if (!POSTLY_PLATFORM_CATALOG.some(p => p.identifier === 'telegram')) throw new Error('catalog missing telegram');
  if (!POSTLY_PLATFORM_CATALOG.some(p => p.identifier === 'x')) throw new Error('catalog missing x');
  if (POSTLY_PLATFORM_CATALOG.find(p => p.identifier === 'reddit')?.availability !== 'docs_only') {
    throw new Error('reddit must be docs_only');
  }
}
