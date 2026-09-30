export function redditPreview(
  title: string,
  body: string,
  settings: Record<string, string>,
) {
  const postTitle = settings.reddit_title || title;
  const community = (settings.reddit_subreddit || '')
    .trim()
    .replace(/^\/?r\//i, '');
  const kind = settings.reddit_kind || (settings.reddit_link ? 'link' : 'self');
  const issues: string[] = [];
  if (!postTitle.trim()) issues.push('Añade un título.');
  if (Array.from(postTitle).length > 300)
    issues.push('El título supera los 300 caracteres.');
  if (!community) issues.push('Elige una comunidad.');
  else if (!/^[A-Za-z0-9_]+$/.test(community))
    issues.push('Escribe el nombre de la comunidad, no su URL.');
  let url: string | null = null;
  let domain = '';
  if (kind === 'link') {
    try {
      const parsed = new URL(settings.reddit_link || '');
      if (
        !['http:', 'https:'].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password
      )
        throw new Error();
      url = parsed.href;
      domain = parsed.hostname;
    } catch {
      issues.push('Añade un enlace HTTP(S) válido, sin credenciales.');
    }
  } else {
    if (!body.trim()) issues.push('Añade el texto de la publicación.');
    if (Array.from(body).length > 40000)
      issues.push('El texto supera los 40.000 caracteres.');
  }
  if (
    settings.reddit_flair &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      settings.reddit_flair.trim(),
    )
  )
    issues.push(
      'La etiqueta necesita el ID de una plantilla de esta comunidad.',
    );
  return { title: postTitle, body, community, kind, url, domain, issues };
}
