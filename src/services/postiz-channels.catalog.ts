/**
 * Postiz channels this connector ships (public API settings schemas).
 * Prefer self-hosted Postiz — do not assume a paid cloud plan.
 * Docs: https://docs.postiz.com/public-api
 */

export type PostizChannelFamily =
  | 'messaging'
  | 'social'
  | 'community'
  | 'live'
  | 'newsletter';

export type PostizChannelCapability = {
  identifier: string;
  label: string;
  family: PostizChannelFamily;
  /** Postiz settings.__type */
  settingsType: string;
  requiredSettings: string[];
  notionOverride: string;
  notionTargetsLabel: string;
};

/** Channels Postiz exposes that we wire here (not Postly / Composio overlaps). */
export const POSTIZ_CHANNEL_CATALOG: PostizChannelCapability[] = [
  {
    identifier: 'discord',
    label: 'Discord',
    family: 'messaging',
    settingsType: 'discord',
    requiredSettings: ['channel'],
    notionOverride: 'Postiz Discord',
    notionTargetsLabel: 'Discord',
  },
  {
    identifier: 'slack',
    label: 'Slack',
    family: 'messaging',
    settingsType: 'slack',
    requiredSettings: ['channel'],
    notionOverride: 'Postiz Slack',
    notionTargetsLabel: 'Slack',
  },
  {
    identifier: 'mastodon',
    label: 'Mastodon',
    family: 'social',
    settingsType: 'mastodon',
    requiredSettings: [],
    notionOverride: 'Postiz Mastodon',
    notionTargetsLabel: 'Mastodon',
  },
  {
    identifier: 'skool',
    label: 'Skool',
    family: 'community',
    settingsType: 'skool',
    requiredSettings: ['group', 'label', 'title'],
    notionOverride: 'Postiz Skool',
    notionTargetsLabel: 'Skool',
  },
  {
    identifier: 'twitch',
    label: 'Twitch',
    family: 'live',
    settingsType: 'twitch',
    requiredSettings: [],
    notionOverride: 'Postiz Twitch',
    notionTargetsLabel: 'Twitch',
  },
  {
    identifier: 'kick',
    label: 'Kick',
    family: 'live',
    settingsType: 'kick',
    requiredSettings: [],
    notionOverride: 'Postiz Kick',
    notionTargetsLabel: 'Kick',
  },
  {
    identifier: 'warpcast',
    label: 'Warpcast',
    family: 'social',
    settingsType: 'warpcast',
    requiredSettings: [],
    notionOverride: 'Postiz Farcaster',
    notionTargetsLabel: 'Warpcast',
  },
  {
    identifier: 'nostr',
    label: 'Nostr',
    family: 'social',
    settingsType: 'nostr',
    requiredSettings: [],
    notionOverride: 'Postiz Nostr',
    notionTargetsLabel: 'Nostr',
  },
  {
    identifier: 'lemmy',
    label: 'Lemmy',
    family: 'community',
    settingsType: 'lemmy',
    requiredSettings: ['subreddit'],
    notionOverride: 'Postiz Lemmy',
    notionTargetsLabel: 'Lemmy',
  },
  {
    identifier: 'listmonk',
    label: 'Listmonk',
    family: 'newsletter',
    settingsType: 'listmonk',
    requiredSettings: ['subject', 'preview', 'list'],
    notionOverride: 'Postiz Listmonk',
    notionTargetsLabel: 'Listmonk',
  },
];

export const POSTIZ_CHANNEL_IDS = POSTIZ_CHANNEL_CATALOG.map(c => c.identifier);

export function getPostizChannel(identifier: string): PostizChannelCapability | undefined {
  const key = identifier.trim().toLowerCase();
  const aliases: Record<string, string> = {
    farcaster: 'warpcast',
    'farcaster (warpcast)': 'warpcast',
    warpcast: 'warpcast',
  };
  const id = aliases[key] || key;
  return POSTIZ_CHANNEL_CATALOG.find(c => c.identifier === id || c.notionTargetsLabel.toLowerCase() === key);
}

export function parsePostizIntegrations(raw: string): { identifier: string; id: string }[] {
  return raw
    .split(',')
    .map(p => p.trim())
    .filter(Boolean)
    .map(entry => {
      const match = entry.match(/^([a-z0-9_-]+):(.+)$/i);
      if (!match) {
        throw new Error(
          `POSTIZ_INTEGRATIONS entry "${entry}" must be identifier:id (e.g. discord:abc123)`
        );
      }
      const identifier = match[1].toLowerCase();
      if (!getPostizChannel(identifier)) {
        throw new Error(`Unknown Postiz channel "${identifier}" in POSTIZ_INTEGRATIONS`);
      }
      return { identifier, id: match[2].trim() };
    });
}
