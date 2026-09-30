export const redditSettings = {
  reddit_title: { notion: 'Reddit Title', type: 'rich_text', max: 300 },
  reddit_subreddit: { notion: 'Reddit Subreddit', type: 'rich_text', max: 100 },
  reddit_kind: { notion: 'Reddit Post Type', type: 'select', max: 4 },
  reddit_link: { notion: 'Reddit Link URL', type: 'url', max: 2000 },
  reddit_flair: { notion: 'Reddit Flair ID', type: 'rich_text', max: 100 },
} as const;
export function parseChannelSettings(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Los campos de canal deben ser un objeto.');
  const entries = Object.entries(value);
  for (const [key, field] of entries) {
    const spec = redditSettings[key as keyof typeof redditSettings];
    if (
      !Object.hasOwn(redditSettings, key) ||
      typeof field !== 'string' ||
      Array.from(field).length > spec.max
    )
      throw new Error('Campo de canal desconocido o demasiado largo: ' + key);
    if (key === 'reddit_kind' && !['', 'self', 'link'].includes(field))
      throw new Error('El tipo de Reddit debe ser self o link.');
    if (key === 'reddit_link' && field) {
      let url: URL;
      try {
        url = new URL(field);
      } catch {
        throw new Error('El enlace de Reddit debe ser una URL HTTP(S).');
      }
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error(
          'El enlace de Reddit debe ser una URL HTTP(S) sin credenciales.',
        );
    }
  }
  return Object.fromEntries(
    entries.filter(([, field]) => field !== ''),
  ) as Record<string, string>;
}
