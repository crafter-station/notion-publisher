import {
  ApiError,
  context,
  handle,
  respond,
} from '../../../../../lib/server/context';
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const ctx = await context(request, true),
      { id } = await params;
    const result = await ctx.db
      .prepare(
        'UPDATE api_tokens SET revoked_at=? WHERE id=? AND workspace_id=? AND user_id=? AND revoked_at IS NULL',
      )
      .bind(new Date().toISOString(), id, ctx.workspaceId, ctx.userId)
      .run();
    if (!result.meta.changes)
      throw new ApiError(
        404,
        'token_not_found',
        'La credencial no existe o ya fue revocada.',
      );
    return respond({ id, revoked: true });
  });
}
