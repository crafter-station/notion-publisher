import { PostlyPlatformCapability } from '../capabilities/types';

/**
 * Static Postly platform catalog from OpenAPI create-post settings discriminator
 * (https://docs.postly.ai/openapi.yaml). Not workspace-connection state.
 */
export const POSTLY_PLATFORM_CATALOG: PostlyPlatformCapability[] = [
  { identifier: 'instagram', settingsSchema: 'InstagramPostSettings', availability: 'api', family: 'social' },
  { identifier: 'facebook', settingsSchema: 'FacebookPostSettings', availability: 'api', family: 'social' },
  { identifier: 'linkedin', settingsSchema: 'LinkedInPostSettings', availability: 'api', family: 'social' },
  { identifier: 'x', settingsSchema: 'XPostSettings', availability: 'api', family: 'social' },
  { identifier: 'threads', settingsSchema: 'ThreadsPostSettings', availability: 'api', family: 'social' },
  { identifier: 'tiktok', settingsSchema: 'TikTokPostSettings', availability: 'api', family: 'social' },
  { identifier: 'youtube', settingsSchema: 'YouTubePostSettings', availability: 'api', family: 'social' },
  { identifier: 'pinterest', settingsSchema: 'PinterestPostSettings', availability: 'api', family: 'social' },
  { identifier: 'bluesky', settingsSchema: 'BlueskyPostSettings', availability: 'api', family: 'social' },
  { identifier: 'googleMyBusiness', settingsSchema: 'GoogleMyBusinessPostSettings', availability: 'api', family: 'social' },
  { identifier: 'telegram', settingsSchema: 'TelegramPostSettings', availability: 'api', family: 'messaging' },
  { identifier: 'whatsapp', settingsSchema: 'WhatsAppPostSettings', availability: 'api', family: 'messaging' },
  { identifier: 'wordpress', settingsSchema: 'WordPressPostSettings', availability: 'api', family: 'blog' },
  { identifier: 'ghost', settingsSchema: 'GhostPostSettings', availability: 'api', family: 'blog' },
  { identifier: 'hashnode', settingsSchema: 'HashnodePostSettings', availability: 'api', family: 'blog' },
  { identifier: 'devTo', settingsSchema: 'DevToPostSettings', availability: 'api', family: 'blog' },
  { identifier: 'blogger', settingsSchema: 'BloggerPostSettings', availability: 'api', family: 'blog' },
  // ponytail: reddit still in OpenAPI but not a real Postly publish path — ship via Composio + Channels=Reddit
  { identifier: 'reddit', settingsSchema: 'RedditPostSettings', availability: 'docs_only', family: 'social' },
  // OpenAPI uses identifier none / provider names for email targets
  { identifier: 'email', settingsSchema: 'none', availability: 'api', family: 'email' },
];

export function getPostlyPlatform(identifier: string): PostlyPlatformCapability | undefined {
  return POSTLY_PLATFORM_CATALOG.find(p => p.identifier === identifier);
}
