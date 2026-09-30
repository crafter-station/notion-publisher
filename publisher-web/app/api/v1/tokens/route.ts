import {
  ApiError,
  context,
  handle,
  respond,
  hashToken,
} from '../../../../lib/server/context';
import { readInput } from '../../../../lib/server/drafts';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return handle(async () => {
    const ctx = await context(request);
    const rows = await ctx.db
      .prepare(
        'SELECT id,name,access,created_at,expires_at,revoked_at FROM api_tokens WHERE workspace_id=? AND user_id=? ORDER BY created_at DESC',
      )
      .bind(ctx.workspaceId, ctx.userId)
      .all();
    return respond({ items: rows.results });
  });
}
export async function POST(request: Request) {
  return handle(async () => {
    const ctx = await context(request, true),
      input = await readInput(request);
    if (
      !input ||
      typeof input.name !== 'string' ||
      !input.name.trim() ||
      input.name.length > 80 ||
      !['read', 'write'].includes(input.access)
    )
      throw new ApiError(
        400,
        'invalid_token_request',
        'Indica nombre y acceso read o write.',
      );
    const token =
        'op_' +
        Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
          b.toString(16).padStart(2, '0'),
        ).join(''),
      id = crypto.randomUUID(),
      createdAt = new Date().toISOString(),
      expiresAt = new Date(Date.now() + 90 * 86400000).toISOString();
    await ctx.db
      .prepare(
        'INSERT INTO api_tokens (id,token_hash,workspace_id,user_id,name,access,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)',
      )
      .bind(
        id,
        await hashToken(token),
        ctx.workspaceId,
        ctx.userId,
        input.name.trim(),
        input.access,
        createdAt,
        expiresAt,
      )
      .run();
    return respond({ id, token, expiresAt, access: input.access }, 201);
  });
}
