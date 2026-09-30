import {
  ApiError,
  context,
  handle,
  respond,
} from '../../../../../../lib/server/context';
import { readInput } from '../../../../../../lib/server/drafts';
export const dynamic = 'force-dynamic';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const ctx = await context(request, true),
      { id } = await params,
      input = await readInput(request);
    if (!input || !Number.isSafeInteger(input.revision) || input.revision < 1)
      throw new ApiError(
        400,
        'revision_required',
        'Incluye la versión que estás revisando.',
      );
    if (!['submit', 'approve', 'return'].includes(input.action))
      throw new ApiError(
        400,
        'invalid_action',
        'Acción de revisión no válida.',
      );
    if (input.action !== 'submit' && ctx.role === 'editor')
      throw new ApiError(
        403,
        'approval_required',
        'Necesitas el rol de aprobador o administrador.',
      );
    const from = input.action === 'submit' ? 'draft' : 'in_review',
      status =
        input.action === 'submit'
          ? 'in_review'
          : input.action === 'approve'
            ? 'approved'
            : 'draft';
    const result = await ctx.db
      .prepare(
        'UPDATE drafts SET status=?,revision=revision+1,updated_by=?,updated_at=? WHERE id=? AND workspace_id=? AND revision=? AND status=?',
      )
      .bind(
        status,
        ctx.userId,
        new Date().toISOString(),
        id,
        ctx.workspaceId,
        input.revision,
        from,
      )
      .run();
    if (!result.meta.changes)
      throw new ApiError(
        409,
        'review_conflict',
        'El contenido o su estado cambió. Actualiza antes de continuar.',
      );
    return respond({ id, status, revision: input.revision + 1 });
  });
}
