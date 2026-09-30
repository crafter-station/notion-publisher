// Notion field names come from the repository's Postiz channel matrix.
// Keep provider copy separate from generic channel copy used by other schedulers.
export const postizFields: Record<string, string> = Object.fromEntries([
  ...[
    'X',
    'Instagram',
    'Facebook',
    'LinkedIn',
    'TikTok',
    'YouTube',
    'Threads',
    'Pinterest',
    'Reddit',
    'Bluesky',
    'Mastodon',
    'Tumblr',
    'VK',
    'MeWe',
    'Lemmy',
    'Skool',
    'Whop',
    'Farcaster',
    'Nostr',
    'Telegram',
    'Discord',
    'Slack',
    'Twitch',
    'Kick',
    'Dribbble',
    'Medium',
    'Hashnode',
    'WordPress',
    'Listmonk',
  ].map((name) => [name, `Postiz ${name}`]),
  ['Devto', 'Postiz Devto'],
  ['GoogleBusinessProfile', 'Postiz Google'],
]);
export const postizVersionKey = (channel: string) => `postiz_${channel}`;
export function channelCopy(
  versions: Record<string, string>,
  body: string,
  channel: string,
  postiz = false,
) {
  return postiz
    ? (versions[postizVersionKey(channel)] ?? versions[channel] ?? body)
    : (versions[channel] ?? body);
}
