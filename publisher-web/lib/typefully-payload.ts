export function typefullyPayload(
  content: { title: string; body: string; versions: Record<string, string>; mediaIds?: string[]; publicationSet?: {accounts:{provider:string;accountId:string;sourceGroupId?:string}[]} | null },
  selected: unknown,
  socialSetId: unknown,
) {
  if (content.mediaIds?.length)
    throw new Error('Este envío de Typefully solo admite texto; el borrador tiene archivos adjuntos.');
  const aliases: Record<string, string> = {
    X: 'x',
    LinkedIn: 'linkedin',
    Threads: 'threads',
    Bluesky: 'bluesky',
    Mastodon: 'mastodon',
  };
  if (!Number.isSafeInteger(socialSetId) || Number(socialSetId) <= 0)
    throw new Error('Selecciona un grupo válido de Typefully.');
  if (
    !Array.isArray(selected) ||
    !selected.length ||
    selected.length > 5 ||
    selected.some((id) => typeof id !== 'string' || !Object.hasOwn(aliases, id))
  )
    throw new Error(
      'Selecciona canales compatibles con Typefully: X, LinkedIn, Threads, Bluesky o Mastodon.',
    );
  const platforms: Record<
    string,
    { enabled: true; posts: { text: string }[] }
  > = {};
  for (const id of new Set(selected as string[])) {
    if (content.publicationSet && !content.publicationSet.accounts.some(account => account.provider === 'typefully' && account.accountId === String(socialSetId) + ':' + aliases[id] && (account.sourceGroupId === undefined || account.sourceGroupId === String(socialSetId))))
      throw new Error('La cuenta seleccionada no pertenece al conjunto guardado en este borrador.');
    const text = content.versions[id] ?? content.body;
    const parts = text.replace(/\r\n/g, '\n').split('\n\n\n\n');
    if (parts.some((part) => !part.trim()))
      throw new Error(
        `Completa todas las publicaciones de ${id} antes de enviar.`,
      );
    platforms[aliases[id]] = {
      enabled: true,
      posts: parts.map((text) => ({ text })),
    };
  }
  return {
    social_set_id: Number(socialSetId),
    draft_title: content.title,
    platforms,
    share: false,
  };
}
export function typefullyReceipt(data: unknown) {
  const value = data as {
    id?: number;
    status?: string;
    private_url?: string;
    share_url?: string | null;
    published_at?: string | null;
  };
  if (
    !value ||
    !Number.isSafeInteger(value.id) ||
    value.id! <= 0 ||
    value.status !== 'draft' ||
    value.share_url ||
    value.published_at
  )
    throw new Error('Unexpected draft state');
  const url = new URL(value.private_url || '');
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'typefully.com' ||
    url.username ||
    url.password
  )
    throw new Error('Unexpected draft URL');
  return { id: value.id!, status: 'draft', private_url: url.href };
}
