import { ApiError, context, handle, respond } from '../../../../lib/server/context';
import {
  parseDraft,
  resolveDraftPublicationSet,
  readInput,
  serializeDraft,
} from '../../../../lib/server/drafts';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return handle(async () => {
    const ctx = await context(request);
    const status = new URL(request.url).searchParams.get('status');
    if (status !== null && !['draft', 'in_review', 'approved'].includes(status))
      throw new ApiError(400, 'invalid_status', 'El estado de revisión no es válido.');
    const rows = await ctx.db
      .prepare(
        status === null
          ? 'SELECT * FROM drafts WHERE workspace_id=? ORDER BY updated_at DESC LIMIT 100'
          : 'SELECT * FROM drafts WHERE workspace_id=? AND status=? ORDER BY updated_at DESC LIMIT 100',
      )
      .bind(...(status === null ? [ctx.workspaceId] : [ctx.workspaceId, status]))
      .all<Record<string, unknown>>();
    return respond({ items: rows.results.map(serializeDraft) });
  });
}
export async function POST(request: Request) {
  return handle(async () => {
    const ctx = await context(request, true),
      input = parseDraft(await readInput(request)),
      id = crypto.randomUUID(),
      now = new Date().toISOString();
    if (input.mediaIds && input.mediaIds !== '[]')
      throw new ApiError(400, 'save_draft_first', 'Guarda el borrador antes de cargar y adjuntar archivos.');
    const publicationSet = await resolveDraftPublicationSet(ctx, input.publicationSet);
    await ctx.db
      .prepare(
        'INSERT INTO drafts (id,workspace_id,title,body,versions,channel_settings,publication_set,status,revision,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,1,?,?,?,?)',
      )
      .bind(
        id,
        ctx.workspaceId,
        input.title,
        input.body,
        input.versions,
        input.channelSettings || '{}',
        publicationSet ?? 'null',
        'draft',
        ctx.userId,
        ctx.userId,
        now,
        now,
      )
      .run();
    return respond({ id, revision: 1, status: 'draft', updated_at: now }, 201);
  });
}
