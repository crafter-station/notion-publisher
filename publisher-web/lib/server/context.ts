import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../app/chatgpt-auth';
export type Role = 'administrator' | 'editor' | 'approver';
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function database(): D1Database {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db)
    throw new ApiError(
      503,
      'storage_unavailable',
      'El almacenamiento no está disponible.',
    );
  return db;
}
export async function context(request: Request, write = false) {
  const authorization = request.headers.get('authorization');
  if (authorization) {
    const token = authorization.match(/^Bearer (op_[a-f0-9]{64})$/)?.[1];
    if (!token)
      throw new ApiError(401, 'invalid_token', 'La credencial no es válida.');
    const hash = await hashToken(token);
    const db = database();
    const member = await db
      .prepare(
        `SELECT t.workspace_id AS workspaceId,t.user_id AS userId,t.access,m.email,m.role FROM api_tokens t JOIN members m ON m.workspace_id=t.workspace_id AND m.user_id=t.user_id WHERE t.token_hash=? AND t.revoked_at IS NULL AND t.expires_at>?`,
      )
      .bind(hash, new Date().toISOString())
      .first<{
        workspaceId: string;
        userId: string;
        email: string;
        role: Role;
        access: string;
      }>();
    if (!member)
      throw new ApiError(
        401,
        'invalid_token',
        'La credencial expiró o fue revocada.',
      );
    const path = new URL(request.url).pathname;
    if (
      !/^\/api\/v1\/(drafts(?:\/[^/]+(?:\/(?:review|notion|typefully))?)?|media(?:\/[^/]+)?|sets(?:\/[^/]+(?:\/verify)?)?|session|channels|connections|notion(?:\/import)?|mcp)$/.test(
        path,
      )
    )
      throw new ApiError(
        403,
        'token_scope_denied',
        'Esta operación requiere una sesión de usuario.',
      );
    if (write && member.access !== 'write')
      throw new ApiError(
        403,
        'token_read_only',
        'La credencial solo permite lectura.',
      );
    return { ...member, db };
  }
  const user = await getChatGPTUser();
  if (!user)
    throw new ApiError(
      401,
      'authentication_required',
      'Inicia sesión para continuar.',
    );
  if (write) {
    const origin = request.headers.get('origin');
    if (origin !== new URL(request.url).origin)
      throw new ApiError(
        403,
        'origin_rejected',
        'La solicitud debe proceder de esta aplicación.',
      );
  }
  const db = database();
  const workspaceId = 'crafter-station';
  const settings = env as unknown as { OPEN_PUBLISHER_OWNER_EMAIL?: string };
  // Owner must be configured at deployment. Never grant admin to the first visitor.
  const ownerEmail = settings.OPEN_PUBLISHER_OWNER_EMAIL;
  const localOwner = import.meta.env.DEV && user.email === 'seedy@sites.test';
  if (
    localOwner ||
    (ownerEmail && user.email.toLowerCase() === ownerEmail.toLowerCase())
  ) {
    await db
      .prepare(
        'INSERT INTO members (workspace_id,user_id,email,role) VALUES (?,?,?,?) ON CONFLICT(workspace_id,user_id) DO NOTHING',
      )
      .bind(workspaceId, user.userId, user.email, 'administrator')
      .run();
  }
  await db
    .prepare(
      'INSERT INTO members (workspace_id,user_id,email,role) SELECT workspace_id,?,?,role FROM invitations WHERE workspace_id=? AND email=? ON CONFLICT(workspace_id,user_id) DO NOTHING',
    )
    .bind(user.userId, user.email, workspaceId, user.email.toLowerCase())
    .run();
  const member = await db
    .prepare('SELECT role FROM members WHERE workspace_id=? AND user_id=?')
    .bind(workspaceId, user.userId)
    .first<{ role: Role }>();
  if (!member)
    throw new ApiError(
      403,
      'membership_required',
      'Tu cuenta aún no pertenece a este equipo.',
    );
  return {
    db,
    workspaceId,
    userId: user.userId,
    email: user.email,
    role: member.role,
  };
}
export function respond(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
export async function handle(operation: () => Promise<Response>) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ApiError)
      return respond(
        { error: { code: error.code, message: error.message } },
        error.status,
      );
    console.error('Open Publisher API operation failed');
    return respond(
      {
        error: {
          code: 'internal_error',
          message: 'No se pudo completar la operación. Vuelve a intentarlo.',
        },
      },
      500,
    );
  }
}

export async function hashToken(token: string) {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
export function requireAdministrator(role: Role) {
  if (role !== 'administrator')
    throw new ApiError(
      403,
      'administrator_required',
      'Esta operación requiere un administrador.',
    );
}
