export type DistributorKind = 'marketplace' | 'social' | 'community' | 'music' | 'other';

/** live = publish wired today; discover = API readable, publish not opted-in; stub = mapped only */
export type DistributorStatus = 'live' | 'discover' | 'stub';

export interface DistributorCapability {
  id: string;
  kind: DistributorKind;
  status: DistributorStatus;
  envKeys: string[];
  notes: string;
}

export type PostlyPlatformAvailability = 'api' | 'docs_only';

export interface PostlyPlatformCapability {
  identifier: string;
  settingsSchema: string;
  /** api = in OpenAPI create-post settings map; docs_only = schema/docs but not for active reconnect (e.g. reddit) */
  availability: PostlyPlatformAvailability;
  family: 'social' | 'messaging' | 'blog' | 'email' | 'other';
}
