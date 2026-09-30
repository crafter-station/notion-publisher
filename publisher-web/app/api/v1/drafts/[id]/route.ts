import {
  ApiError,
  context,
  handle,
  respond,
} from '../../../../../lib/server/context';
import {
  parseDraft,
  resolveDraftPublicationSet,
  readInput,
  serializeDraft,
} from '../../../../../lib/server/drafts';
type Params = { params: Promise<{ id: string }> };
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await context(request),
      { id } = await params;
    const row = await ctx.db
      .prepare('SELECT * FROM drafts WHERE id=? AND workspace_id=?')
      .bind(id, ctx.workspaceId)
      .first<Record<string, unknown>>();
    if (!row)
      throw new ApiError(
        404,
        'draft_not_found',
        'No encontramos este borrador.',
      );
    const notion = await ctx.db
      .prepare(
        'SELECT page_id,notion_url,remote_edited_at,imported_at FROM notion_links WHERE draft_id=? AND workspace_id=?',
      )
      .bind(id, ctx.workspaceId)
      .first();
    return respond({ ...serializeDraft(row), notion });
  });
}
export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await context(request, true),
      { id } = await params,
      raw = await readInput(request),
      input = parseDraft(raw);
    if (!Number.isSafeInteger(raw.revision) || raw.revision < 1)
      throw new ApiError(
        400,
        'revision_required',
        'Incluye la versión que estás editando.',
      );
    if (input.mediaIds !== undefined) {
      if (ctx.role === 'approver') throw new ApiError(403, 'editor_required', 'Cambiar archivos requiere un editor o administrador.');
      const ids: string[] = JSON.parse(input.mediaIds);
      if (ids.length) {
        const valid = await ctx.db.prepare(`SELECT COUNT(*) AS count FROM media_uploads WHERE workspace_id=? AND draft_id=? AND state='ready' AND id IN (${ids.map(() => '?').join(',')})`).bind(ctx.workspaceId, id, ...ids).first<{count:number}>();
        if (valid?.count !== ids.length) throw new ApiError(409, 'media_not_ready', 'Todos los archivos deben estar completos y pertenecer a este borrador.');
      }
    }
    let publicationSet: string | undefined;
    if (input.publicationSet !== undefined) {
      const previous = await ctx.db.prepare('SELECT publication_set FROM drafts WHERE id=? AND workspace_id=?').bind(id, ctx.workspaceId).first<{publication_set:string}>();
      if (!previous) throw new ApiError(404, 'draft_not_found', 'No encontramos este borrador.');
      publicationSet = await resolveDraftPublicationSet(ctx, input.publicationSet, previous.publication_set);
    }
    const now = new Date().toISOString();
    const result = await ctx.db
      .prepare(
        "UPDATE drafts SET title=?,body=?,versions=?,channel_settings=COALESCE(?,channel_settings),media_ids=COALESCE(?,media_ids),publication_set=COALESCE(?,publication_set),revision=revision+1,updated_by=?,updated_at=?,status='draft' WHERE id=? AND workspace_id=? AND revision=?",
      )
      .bind(
        input.title,
        input.body,
        input.versions,
        input.channelSettings ?? null,
        input.mediaIds ?? null,
        publicationSet ?? null,
        ctx.userId,
        now,
        id,
        ctx.workspaceId,
        raw.revision,
      )
      .run();
    if (!result.meta.changes)
      throw new ApiError(
        409,
        'revision_conflict',
        'El borrador cambió. Abre la versión actual antes de guardar.',
      );
    return respond({
      id,
      revision: raw.revision + 1,
      status: 'draft',
      updated_at: now,
    });
  });
}
