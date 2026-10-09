import { parseChannelSettings } from '../channel-settings';
import { ApiError, type context } from './context';
export function parseDraft(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ApiError(400, 'invalid_draft', 'El borrador debe ser un objeto.');
  const input = value as Record<string, unknown>;
  if (
    typeof input.title !== 'string' ||
    input.title.length > 200 ||
    typeof input.body !== 'string' ||
    input.body.length > 100000
  )
    throw new ApiError(
      400,
      'invalid_content',
      'El título admite 200 caracteres; el contenido, 100 000.',
    );
  if (
    !input.versions ||
    typeof input.versions !== 'object' ||
    Array.isArray(input.versions)
  )
    throw new ApiError(
      400,
      'invalid_versions',
      'Las versiones deben ser un objeto.',
    );
  const entries = Object.entries(input.versions);
  if (
    entries.length > 100 ||
    entries.some(
      ([key, text]) =>
        !/^[a-zA-Z0-9_-]{1,80}$/.test(key) ||
        typeof text !== 'string' ||
        text.length > 100000,
    )
  )
    throw new ApiError(
      400,
      'invalid_versions',
      'Una versión no tiene un formato válido.',
    );
  let channelSettings: string | undefined;
  if (input.channelSettings !== undefined) {
    try {
      channelSettings = JSON.stringify(
        parseChannelSettings(input.channelSettings),
      );
    } catch (error) {
      throw new ApiError(
        400,
        'invalid_channel_settings',
        error instanceof Error ? error.message : 'Campos inválidos.',
      );
    }
  }
  let mediaIds: string | undefined;
  if (input.mediaIds !== undefined) {
    if (!Array.isArray(input.mediaIds) || input.mediaIds.length > 100 || input.mediaIds.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) || new Set(input.mediaIds).size !== input.mediaIds.length)
      throw new ApiError(400, 'invalid_media_ids', 'Indica una lista de archivos sin duplicados.');
    mediaIds = JSON.stringify(input.mediaIds);
  }
  let publicationSet: { id: string; revision: number } | null | undefined;
  if (input.publicationSet !== undefined) {
    const selection = input.publicationSet as Record<string, unknown> | null;
    if (selection === null) publicationSet = null;
    else if (!selection || typeof selection !== 'object' || Array.isArray(selection) || typeof selection.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(selection.id) || !Number.isSafeInteger(selection.revision) || Number(selection.revision) < 1)
      throw new ApiError(400, 'invalid_publication_set', 'Selecciona un conjunto y su revisión.');
    else publicationSet = { id: selection.id, revision: Number(selection.revision) };
  }
  return {
    publicationSet,
    mediaIds,
    channelSettings,
    title: input.title,
    body: input.body,
    versions: JSON.stringify(Object.fromEntries(entries)),
  };
}
export async function readInput(request: Request) {
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 1000000) {
          await reader.cancel();
          throw new ApiError(
            413,
            'input_too_large',
            'El contenido supera el tamaño permitido.',
          );
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const raw = new TextDecoder().decode(bytes);
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError(
      400,
      'invalid_json',
      'La solicitud no contiene JSON válido.',
    );
  }
}
export function serializeDraft(row: Record<string, unknown>) {
  const { channel_settings, media_ids, publication_set, ...rest } = row;
  return {
    ...rest,
    title: String(row.title),
    body: String(row.body),
    versions: JSON.parse(String(row.versions)),
    publicationSet: JSON.parse(typeof publication_set === 'string' ? publication_set : 'null'),
    mediaIds: JSON.parse(typeof media_ids === 'string' ? media_ids : '[]'),
    channelSettings: JSON.parse(typeof channel_settings === 'string' ? channel_settings : '{}'),
  };
}

export async function resolveDraftPublicationSet(
  ctx: Awaited<ReturnType<typeof context>>,
  selection: ReturnType<typeof parseDraft>['publicationSet'],
  existing?: string,
) {
  if (selection === undefined) return undefined;
  if (ctx.role === 'approver') throw new ApiError(403, 'editor_required', 'Cambiar el conjunto requiere un editor o administrador.');
  if (selection === null) return 'null';
  const previous = existing ? JSON.parse(existing) : null;
  // Preserve the reviewed account snapshot when a normal content save sends the same reference.
  if (previous?.id === selection.id && previous?.revision === selection.revision) return existing;
  const set = await ctx.db.prepare('SELECT id,name,revision,accounts FROM publication_sets WHERE workspace_id=? AND id=?').bind(ctx.workspaceId, selection.id).first<{id:string;name:string;revision:number;accounts:string}>();
  if (!set) throw new ApiError(404, 'set_not_found', 'No encontramos este conjunto en tu equipo.');
  if (set.revision !== selection.revision) throw new ApiError(409, 'set_revision_conflict', 'El conjunto cambió. Actualiza las cuentas antes de seleccionarlo.');
  return JSON.stringify({id:set.id,name:set.name,revision:set.revision,accounts:JSON.parse(set.accounts)});
}
