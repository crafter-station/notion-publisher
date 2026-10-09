import {
  ApiError,
  context,
  handle,
  respond,
  requireAdministrator,
} from '../../../../lib/server/context';
import { readInput } from '../../../../lib/server/drafts';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return handle(async () => {
    const ctx = await context(request);
    requireAdministrator(ctx.role);
    const [members, invitations] = await Promise.all([
      ctx.db
        .prepare('SELECT user_id,email,role FROM members WHERE workspace_id=?')
        .bind(ctx.workspaceId)
        .all(),
      ctx.db
        .prepare(
          'SELECT email,role,created_at FROM invitations WHERE workspace_id=?',
        )
        .bind(ctx.workspaceId)
        .all(),
    ]);
    return respond({
      members: members.results,
      invitations: invitations.results,
    });
  });
}
export async function POST(request: Request) {
  return handle(async () => {
    const ctx = await context(request, true);
    requireAdministrator(ctx.role);
    const input = await readInput(request);
    if (
      !input ||
      typeof input.email !== 'string' ||
      input.email.length > 254 ||
      !/^\S+@\S+\.\S+$/.test(input.email) ||
      !['editor', 'approver'].includes(input.role)
    )
      throw new ApiError(
        400,
        'invalid_invitation',
        'Indica un correo y el rol editor o aprobador.',
      );
    const email = input.email.trim().toLowerCase();
    await ctx.db
      .prepare(
        'INSERT INTO invitations (workspace_id,email,role,created_by,created_at) VALUES (?,?,?,?,?) ON CONFLICT(workspace_id,email) DO UPDATE SET role=excluded.role',
      )
      .bind(
        ctx.workspaceId,
        email,
        input.role,
        ctx.userId,
        new Date().toISOString(),
      )
      .run();
    await ctx.db
      .prepare(
        "UPDATE members SET role=? WHERE workspace_id=? AND lower(email)=? AND role!='administrator'",
      )
      .bind(input.role, ctx.workspaceId, email)
      .run();
    return respond(
      { email, role: input.role, status: 'authorized', emailSent: false },
      201,
    );
  });
}

export async function DELETE(request: Request) {
  return handle(async () => {
    const ctx = await context(request, true);
    requireAdministrator(ctx.role);
    const input = await readInput(request);
    if (!input || typeof input.email !== 'string')
      throw new ApiError(
        400,
        'email_required',
        'Indica el correo que deseas retirar.',
      );
    const email = input.email.trim().toLowerCase();
    const member = await ctx.db
      .prepare(
        'SELECT role FROM members WHERE workspace_id=? AND lower(email)=?',
      )
      .bind(ctx.workspaceId, email)
      .first<{ role: string }>();
    if (member?.role === 'administrator')
      throw new ApiError(
        403,
        'administrator_protected',
        'No se puede retirar a un administrador desde esta operación.',
      );
    await ctx.db.batch([
      ctx.db
        .prepare(
          "UPDATE api_tokens SET revoked_at=? WHERE workspace_id=? AND user_id IN (SELECT user_id FROM members WHERE workspace_id=? AND lower(email)=? AND role!='administrator') AND revoked_at IS NULL",
        )
        .bind(
          new Date().toISOString(),
          ctx.workspaceId,
          ctx.workspaceId,
          email,
        ),
      ctx.db
        .prepare('DELETE FROM invitations WHERE workspace_id=? AND email=?')
        .bind(ctx.workspaceId, email),
      ctx.db
        .prepare(
          "DELETE FROM members WHERE workspace_id=? AND lower(email)=? AND role!='administrator'",
        )
        .bind(ctx.workspaceId, email),
    ]);
    return respond({ email, removed: true });
  });
}
