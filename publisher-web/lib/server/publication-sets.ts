import { connectionReaders } from './connection-readers';
import type { ConnectionInventory } from './connections';
import { ApiError, context, respond } from './context';
import { readInput } from './drafts';
const setId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
type AccountReference = {
  provider: string;
  accountId: string;
  sourceGroupId?: string;
};
type SetRow = {
  id: string;
  name: string;
  accounts: string;
  revision: number;
  created_at: string;
  updated_at: string;
};
function validId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !setId.test(id))
    throw new ApiError(
      400,
      'invalid_set_id',
      'Usa un UUID en minúsculas para identificar el conjunto.',
    );
}
function parseSet(input: Record<string, unknown>) {
  if (
    typeof input.name !== 'string' ||
    !input.name.trim() ||
    input.name.trim().length > 120 ||
    !Array.isArray(input.accounts) ||
    input.accounts.length > 200
  )
    throw new ApiError(
      400,
      'invalid_set',
      'Indica un nombre y hasta 200 referencias de cuentas.',
    );
  const identities = new Set<string>();
  const accounts: AccountReference[] = input.accounts.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new ApiError(
        400,
        'invalid_account_reference',
        'La referencia de cuenta no es válida.',
      );
    const { provider, accountId, sourceGroupId } = value as Record<
      string,
      unknown
    >;
    const text = (v: unknown): v is string =>
      typeof v === 'string' &&
      v.length > 0 &&
      v.length <= 512 &&
      !Array.from(v).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) &&
      v.trim() === v;
    if (
      typeof provider !== 'string' ||
      !/^[a-z0-9_-]{1,80}$/.test(provider) ||
      !text(accountId) ||
      (sourceGroupId !== undefined && !text(sourceGroupId))
    )
      throw new ApiError(
        400,
        'invalid_account_reference',
        'Incluye proveedor e identificador de cuenta válidos.',
      );
    const key = JSON.stringify([provider, accountId]);
    if (identities.has(key))
      throw new ApiError(
        400,
        'duplicate_account_reference',
        'La misma cuenta y proveedor solo pueden aparecer una vez.',
      );
    identities.add(key);
    return {
      provider,
      accountId,
      ...(sourceGroupId === undefined ? {} : { sourceGroupId }),
    };
  });
  return { name: input.name.trim(), accounts: JSON.stringify(accounts) };
}
function serializeSet(row: SetRow) {
  return {
    id: row.id,
    name: row.name,
    accounts: JSON.parse(row.accounts) as AccountReference[],
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    accountVerification: 'not_checked',
    publicationAuthorized: false,
  };
}
async function editor(request: Request) {
  const ctx = await context(request, true);
  if (ctx.role === 'approver')
    throw new ApiError(
      403,
      'editor_required',
      'Se requiere un editor o administrador para modificar conjuntos.',
    );
  return ctx;
}
async function row(ctx: Awaited<ReturnType<typeof context>>, id: string) {
  const item = await ctx.db
    .prepare('SELECT * FROM publication_sets WHERE workspace_id=? AND id=?')
    .bind(ctx.workspaceId, id)
    .first<SetRow>();
  if (!item)
    throw new ApiError(404, 'set_not_found', 'No encontramos este conjunto.');
  return item;
}
export async function listPublicationSets(request: Request) {
  const ctx = await context(request);
  const after = new URL(request.url).searchParams.get('after');
  if (after !== null) validId(after);
  const result = await ctx.db
    .prepare(
      'SELECT * FROM publication_sets WHERE workspace_id=? AND id>? ORDER BY id LIMIT 51',
    )
    .bind(ctx.workspaceId, after || '')
    .all<SetRow>();
  return respond({
    items: result.results.slice(0, 50).map(serializeSet),
    nextCursor: result.results.length > 50 ? result.results[49].id : null,
  });
}
export async function getPublicationSet(request: Request, id: string) {
  const ctx = await context(request);
  validId(id);
  return respond(serializeSet(await row(ctx, id)));
}
export async function createPublicationSet(request: Request) {
  const ctx = await editor(request),
    input = await readInput(request);
  validId(input.id);
  const parsed = parseSet(input),
    now = new Date().toISOString();
  const result = await ctx.db
    .prepare(
      'INSERT INTO publication_sets(id,workspace_id,name,accounts,revision,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,?,1,?,?,?,?) ON CONFLICT(workspace_id,id) DO NOTHING',
    )
    .bind(
      input.id,
      ctx.workspaceId,
      parsed.name,
      parsed.accounts,
      ctx.userId,
      ctx.userId,
      now,
      now,
    )
    .run();
  const current = await row(ctx, input.id);
  if (
    !result.meta.changes &&
    (current.revision !== 1 ||
      current.name !== parsed.name ||
      current.accounts !== parsed.accounts)
  )
    throw new ApiError(
      409,
      'set_exists',
      'El identificador ya pertenece a otro conjunto o cambió. Consulta su versión actual.',
    );
  return respond(serializeSet(current), result.meta.changes ? 201 : 200);
}
export async function updatePublicationSet(request: Request, id: string) {
  const ctx = await editor(request);
  validId(id);
  const input = await readInput(request),
    parsed = parseSet(input);
  if (!Number.isSafeInteger(input.revision) || input.revision < 1)
    throw new ApiError(
      400,
      'revision_required',
      'Incluye la revisión que estás editando.',
    );
  await row(ctx, id);
  const result = await ctx.db
    .prepare(
      'UPDATE publication_sets SET name=?,accounts=?,revision=revision+1,updated_by=?,updated_at=? WHERE workspace_id=? AND id=? AND revision=?',
    )
    .bind(
      parsed.name,
      parsed.accounts,
      ctx.userId,
      new Date().toISOString(),
      ctx.workspaceId,
      id,
      input.revision,
    )
    .run();
  if (!result.meta.changes)
    throw new ApiError(
      409,
      'revision_conflict',
      'El conjunto cambió. Consulta su versión actual.',
    );
  return respond(serializeSet(await row(ctx, id)));
}

export async function verifyPublicationSet(request: Request, id: string) {
  const ctx = await context(request);
  validId(id);
  const current = await row(ctx, id);
  const accounts = JSON.parse(current.accounts) as AccountReference[];
  const inventories = new Map<string, ConnectionInventory>();
  await Promise.all([...new Set(accounts.map(account => account.provider))].map(async provider => {
    if (!Object.hasOwn(connectionReaders, provider)) return;
    try {
      inventories.set(provider, await connectionReaders[provider as keyof typeof connectionReaders]());
    } catch {
      inventories.set(provider, { provider, state: 'read_failed', checkedAt: new Date().toISOString(), message: 'No se pudo consultar el proveedor.', accounts: [], groups: [] });
    }
  }));
  const items = accounts.map(reference => {
    const inventory = inventories.get(reference.provider);
    const base = { ...reference, checkedAt: inventory?.checkedAt ?? null, publicationAuthorized: false };
    if (!inventory) return { ...base, state: 'unsupported_provider' };
    if (inventory.state !== 'read_verified') return { ...base, state: inventory.state };
    const account = inventory.accounts.find(account => account.id === reference.accountId);
    if (!account) return { ...base, state: 'account_missing' };
    const details = { ...base, channel: account.channel, connected: account.connected, hidden: account.hidden };
    if (reference.sourceGroupId !== undefined) {
      const group = inventory.groups.find(group => group.id === reference.sourceGroupId);
      if (!group) return { ...details, state: 'group_missing' };
      if (!group.channelIds.includes(reference.accountId)) return { ...details, state: 'group_membership_mismatch' };
    }
    if (!account.connected) return { ...details, state: 'account_disconnected' };
    if (account.hidden) return { ...details, state: 'account_hidden' };
    return { ...details, state: 'reference_verified' };
  });
  return respond({ id, revision: current.revision, checkedAt: new Date().toISOString(), items, publicationAuthorized: false });
}
