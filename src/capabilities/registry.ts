import { POSTLY_PLATFORM_CATALOG } from '../services/postly-platforms.catalog';
import { DistributorCapability } from './types';

/**
 * Distributors by layer (publish channels):
 * - Events: luma (live); Eventbrite via composio (live · dry-run default); restream (live · dry-run only)
 * - Products: gumroad (live), github (live · TheVeller Releases), myskool (discover)
 * - Social: postly (live), composio (live · Reddit), typefully (live · dry-run default), postiz (live · dry-run default)
 * - Music/Podcast: once (stub)
 */
export const DISTRIBUTORS: DistributorCapability[] = [
  {
    id: 'luma',
    kind: 'other',
    status: 'live',
    envKeys: ['LUMA_API_KEY'],
    notes:
      'Events layer (Luma / lu.ma). POST /webhooks/publish-luma creates events + optional cover via /v1/images/create-upload-url. Update/tickets out of v1.',
  },
  {
    id: 'gumroad',
    kind: 'marketplace',
    status: 'live',
    envKeys: ['GUMROAD_TOKEN'],
    notes: 'Products layer. Digital storefront: draft/create/upload/publish/unpublish + autopilot.',
  },
  {
    id: 'github',
    kind: 'marketplace',
    status: 'live',
    envKeys: ['GITHUB_TOKEN'],
    notes:
      'Products layer. Catalog + POST /webhooks/publish-github Releases under TheVeller only (asset from Template/File).',
  },
  {
    id: 'myskool',
    kind: 'community',
    status: 'discover',
    envKeys: ['SKOOL_API_KEY', 'SKOOL_GROUP_ID'],
    notes:
      'Products + community via MySkool (https://api.myskool.xyz/v1). Read groups/posts/comments. Create post still upstream Phase 2 — no publish webhook.',
  },
  {
    id: 'postly',
    kind: 'social',
    status: 'live',
    envKeys: ['POSTLY_API_KEY', 'POSTLY_WORKSPACE_ID', 'POSTLY_TARGET_PLATFORMS'],
    notes:
      'Social layer. Broad multi-channel cloud. Reddit is docs_only here — publish via Composio. Optional POSTLY_AUDIENCE_GROUP unused by default.',
  },
  {
    id: 'composio',
    kind: 'other',
    status: 'live',
    envKeys: ['COMPOSIO_API_KEY'],
    notes:
      'Source Tag Composio. Reddit (REDDIT_CREATE_REDDIT_POST) and Eventbrite (EVENTBRITE_CREATE_EVENT) via POST /webhooks/publish-composio. Dry-run default. Live needs COMPOSIO_PUBLISH_LIVE=true. Multi-account: COMPOSIO_USER_ID + COMPOSIO_CONNECTED_ACCOUNT_ID / COMPOSIO_EVENTBRITE_CONNECTED_ACCOUNT_ID.',
  },
  {
    id: 'typefully',
    kind: 'social',
    status: 'live',
    envKeys: ['TYPEFULLY_API_KEY', 'TYPEFULLY_SOCIAL_SET_ID'],
    notes:
      'Social layer. Typefully v2 drafts: X, LinkedIn, Threads, Mastodon, Bluesky. Dry-run default (exact POST /v2/social-sets/{id}/drafts payload). Never sends publish_at — draft or plan_at only. Live needs TYPEFULLY_PUBLISH_LIVE=true.',
  },
  {
    id: 'postiz',
    kind: 'social',
    status: 'live',
    envKeys: ['POSTIZ_API_KEY', 'POSTIZ_API_BASE', 'POSTIZ_INTEGRATIONS'],
    notes:
      'Social layer. Public API POST /public/v1/posts. Wired channels: Discord, Slack, Mastodon, Skool, Twitch, Kick, Warpcast, Nostr, Lemmy, Listmonk. Dry-run default (exact payload, no create). Live needs POSTIZ_PUBLISH_LIVE=true. Prefer self-hosted POSTIZ_API_BASE — no paid cloud plan assumed. MySkool write stays out of scope.',
  },
  {
    id: 'restream',
    kind: 'other',
    status: 'live',
    envKeys: ['RESTREAM_ACCESS_TOKEN', 'RESTREAM_CLIENT_ID', 'RESTREAM_CLIENT_SECRET', 'RESTREAM_REFRESH_TOKEN'],
    notes:
      'Live multistream create/schedule only via POST /v2/user/events/new. Always dry-run — never calls create, never go-live. StreamYard excluded. OAuth token from env only.',
  },
  {
    id: 'once',
    kind: 'music',
    status: 'stub',
    envKeys: ['ONCE_API_KEY'],
    notes: 'Music / Podcast layer (ONCE.app). DSP distribution. Mapped only.',
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
      'Notion CMS orchestrator — events (Luma; Eventbrite via Composio; Restream dry-run), products (Gumroad, GitHub, Skool), social (Postly, Composio/Reddit, Typefully, Postiz), music/podcast (ONCE.app)',
    layers: {
      events: ['luma', 'composio', 'restream'],
      products: ['gumroad', 'github', 'myskool'],
      social: ['postly', 'composio', 'typefully', 'postiz'],
      music: ['once'],
    },
    distributors: listDistributors(),
    postly_platforms: POSTLY_PLATFORM_CATALOG,
  };
}

/** Throws if registry invariants break. */
export function checkRegistryHealthy(): void {
  if (DISTRIBUTORS.length < 9) throw new Error('expected at least 9 distributors');
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
  if (getDistributor('github')?.status !== 'live') throw new Error('github must be live');
  if (getDistributor('composio')?.status !== 'live') throw new Error('composio must be live');
  if (getDistributor('postiz')?.status !== 'live') throw new Error('postiz must be live');
  if (getDistributor('typefully')?.status !== 'live') throw new Error('typefully must be live');
  if (!getDistributor('once')) throw new Error('once stub missing');
  if (getDistributor('luma')?.status !== 'live') throw new Error('luma must be live');
  if (getDistributor('restream')?.status !== 'live') throw new Error('restream must be live');
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
