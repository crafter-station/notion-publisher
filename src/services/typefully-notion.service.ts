/** Notion -> Typefully contract. Pure conversion; never publishes or chooses an account. */
type RichText = { plain_text?: string; text?: { content?: string } };
type Property = { rich_text?: RichText[]; title?: RichText[]; select?: { name: string } | null; multi_select?: { name: string }[]; files?: unknown[]; url?: string | null };
export function buildTypefullyDraft(properties: Record<string, Property>) {
  const text = (name: string) => {
    const p = properties[name];
    return (p?.rich_text || p?.title)?.map(t => t.plain_text ?? t.text?.content ?? '').join('') || p?.select?.name || '';
  };
  const account = text('Typefully Account').trim();
  if (!/^[1-9]\d*$/.test(account) || !Number.isSafeInteger(Number(account))) throw new Error('Typefully Account debe contener el ID numérico del social set, no el nombre ni el ID de Composio.');
  if (properties['Typefully URL']?.url) throw new Error('Esta ficha ya tiene Typefully URL. Abre el borrador existente antes de crear otro.');
  const selected = [...new Set((properties.Channels?.multi_select || []).map(c => c.name))];
  const aliases: Record<string, string> = { X: 'x', Twitter: 'x', LinkedIn: 'linkedin', Threads: 'threads', Bluesky: 'bluesky', Mastodon: 'mastodon' };
  if (!selected.length) throw new Error('Selecciona al menos un canal en Channels.');
  const unsupported = selected.filter(c => !aliases[c]);
  if (unsupported.length) throw new Error('Typefully no cubre estos canales seleccionados: ' + unsupported.join(', ') + '. Usa su proveedor correspondiente.');
  // Never silently drop media while the upload path is not implemented.
  if (['Image', 'Video', 'GIF', 'Audio'].some(name => properties[name]?.files?.length)) throw new Error('Esta ficha contiene medios. La carga de medios en Typefully todavía requiere implementación; no se enviará un borrador incompleto.');
  const caption = text('Caption');
  const copy: Record<string, string> = {
    x: text('X Post') || text('Twitter Post') || caption,
    linkedin: text('LinkedIn Post') || caption,
    threads: text('Twitter Post') || caption,
    bluesky: text('Typefully Bluesky') || text('Bluesky Post') || caption,
    mastodon: text('Typefully Mastodon') || caption,
  };
  const platforms: Record<string, { enabled: true; posts: { text: string }[] }> = {};
  for (const platform of new Set(selected.map(c => aliases[c]))) {
    let content = copy[platform];
    if (platform === 'x' && text('Typefully Thread').trim()) content += '\n\n\n\n' + text('Typefully Thread');
    if (!content.trim()) throw new Error('Falta contenido para ' + platform + '. Completa su campo o Caption.');
    platforms[platform] = { enabled: true, posts: content.split(/\n{4,}/).filter(part => part.trim()).map(part => ({ text: part })) };
  }
  return { social_set_id: Number(account), draft_title: text('Name') || undefined, platforms, share: false };
}
