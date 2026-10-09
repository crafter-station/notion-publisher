import { postizIntegrations } from './postiz-integrations';
const destinations = [
  {
    name: 'Substack',
    category: 'Social',
    logo: '',
    routes: ['Typefully vía Composio'],
  },
  {
    name: 'Instagram',
    category: 'Social',
    logo: 'instagram.png',
    routes: ['Postly', 'Postiz'],
  },
  {
    name: 'Facebook',
    category: 'Social',
    logo: 'facebook.png',
    routes: ['Postly', 'Postiz'],
  },
  {
    name: 'LinkedIn',
    category: 'Social',
    logo: 'linkedin.png',
    routes: ['Postly', 'Typefully vía Composio', 'Postiz'],
  },
  {
    name: 'X / Twitter',
    category: 'Social',
    logo: 'x.png',
    routes: ['Postly', 'Typefully vía Composio', 'Postiz'],
  },
  {
    name: 'Threads',
    category: 'Social',
    logo: 'threads.png',
    routes: ['Postly', 'Typefully vía Composio', 'Postiz'],
  },
  {
    name: 'TikTok',
    category: 'Social',
    logo: 'tiktok.png',
    routes: ['Postly', 'Postiz'],
  },
  {
    name: 'YouTube',
    category: 'Social',
    logo: 'youtube.png',
    routes: ['Postly', 'Postiz'],
  },
  {
    name: 'Pinterest',
    category: 'Social',
    logo: 'pinterest.png',
    routes: ['Postly', 'Postiz'],
  },
  {
    name: 'Bluesky',
    category: 'Social',
    logo: 'bluesky.png',
    routes: ['Postly', 'Typefully vía Composio', 'Postiz'],
  },
  {
    name: 'Google Business Profile',
    category: 'Social',
    logo: 'google-business.png',
    routes: ['Postly', 'Postiz'],
  },
  {
    name: 'Telegram',
    category: 'Social',
    logo: 'telegram.png',
    routes: ['Postly', 'Postiz'],
  },
  {
    name: 'WhatsApp',
    category: 'Social',
    logo: 'whatsapp.png',
    routes: ['Postly'],
  },
  {
    name: 'WordPress',
    category: 'Social',
    logo: 'wordpress.png',
    routes: ['Postly', 'Postiz'],
  },
  {
    name: 'Ghost',
    category: 'Social',
    logo: 'ghost.png',
    routes: ['Postly'],
  },
  {
    name: 'Hashnode',
    category: 'Social',
    logo: 'hashnode.png',
    routes: ['Postly', 'Postiz'],
  },
  {
    name: 'Dev.to',
    category: 'Social',
    logo: 'devto.png',
    routes: ['Postly', 'Postiz'],
  },
  {
    name: 'Blogger',
    category: 'Social',
    logo: 'blogger.png',
    routes: ['Postly'],
  },
  {
    name: 'Email',
    category: 'Social',
    logo: 'email.png',
    routes: ['Postly'],
  },
  {
    name: 'Reddit',
    category: 'Social',
    logo: 'reddit.png',
    routes: ['Composio', 'Postiz'],
  },
  {
    name: 'Mastodon',
    category: 'Social',
    logo: 'mastodon.png',
    routes: ['Postiz', 'Typefully vía Composio'],
  },
  {
    name: 'Medium',
    category: 'Social',
    logo: 'medium.png',
    routes: ['Postiz'],
  },
  {
    name: 'Discord',
    category: 'Social',
    logo: 'discord.png',
    routes: ['Postiz'],
  },
  {
    name: 'Slack',
    category: 'Social',
    logo: 'slack.png',
    routes: ['Postiz'],
  },
  {
    name: 'Twitch',
    category: 'Social',
    logo: 'twitch.png',
    routes: ['Postiz'],
  },
  {
    name: 'Luma Event Page',
    category: 'Eventos',
    logo: 'luma.png',
    routes: ['Luma'],
  },
  {
    name: 'Eventbrite',
    category: 'Eventos',
    logo: 'eventbrite.png',
    routes: ['Composio'],
  },
  {
    name: 'Gumroad Storefront',
    category: 'Productos',
    logo: 'gumroad.png',
    routes: ['Gumroad'],
  },
  {
    name: 'GitHub Releases',
    category: 'Productos',
    logo: 'github.png',
    routes: ['GitHub'],
  },
  {
    name: 'Skool',
    category: 'Productos',
    logo: 'skool.png',
    routes: ['MySkool', 'Postiz'],
  },
  {
    name: 'Spotify',
    category: 'Música y podcast',
    logo: 'spotify.png',
    routes: ['ONCE'],
  },
  {
    name: 'Apple Music',
    category: 'Música y podcast',
    logo: 'apple-music.png',
    routes: ['ONCE'],
  },
  {
    name: 'YouTube Music',
    category: 'Música y podcast',
    logo: 'youtube.png',
    routes: ['ONCE'],
  },
  {
    name: 'Amazon Music',
    category: 'Música y podcast',
    logo: 'once.png',
    routes: ['ONCE'],
  },
  {
    name: 'Tidal',
    category: 'Música y podcast',
    logo: 'once.png',
    routes: ['ONCE'],
  },
  {
    name: 'Deezer',
    category: 'Música y podcast',
    logo: 'once.png',
    routes: ['ONCE'],
  },
  {
    name: 'Pandora',
    category: 'Música y podcast',
    logo: 'once.png',
    routes: ['ONCE'],
  },
  {
    name: 'Tumblr',
    category: 'Social',
    logo: '',
    routes: ['Postiz'],
  },
  {
    name: 'VK',
    category: 'Social',
    logo: '',
    routes: ['Postiz'],
  },
  {
    name: 'MeWe',
    category: 'Social',
    logo: '',
    routes: ['Postiz'],
  },
  {
    name: 'Lemmy',
    category: 'Social',
    logo: '',
    routes: ['Postiz'],
  },
  {
    name: 'Whop',
    category: 'Social',
    logo: '',
    routes: ['Postiz'],
  },
  {
    name: 'Farcaster',
    category: 'Social',
    logo: '',
    routes: ['Postiz'],
  },
  {
    name: 'Nostr',
    category: 'Social',
    logo: '',
    routes: ['Postiz'],
  },
  {
    name: 'Kick',
    category: 'Social',
    logo: '',
    routes: ['Postiz'],
  },
  {
    name: 'Dribbble',
    category: 'Social',
    logo: '',
    routes: ['Postiz'],
  },
  {
    name: 'Listmonk',
    category: 'Social',
    logo: '',
    routes: ['Postiz'],
  },
  { name: 'Moltbook', category: 'Social', logo: '', routes: ['Postiz'] },
] as const;

// These IDs are persisted in draft versions and consumed by API/MCP clients.
// Preserve existing text-channel keys; display names may contain spaces or punctuation.
export const channelCatalog = destinations.map((destination) => {
  const id =
    destination.name === 'X / Twitter'
      ? 'X'
      : destination.name.replace(/[^a-zA-Z0-9_-]/g, '');
  return {
    ...destination,
    id,
    postizIntegrations: postizIntegrations.filter(
      (integration) => integration.channelId === id,
    ),
  };
});
