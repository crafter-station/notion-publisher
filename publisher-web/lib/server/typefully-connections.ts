import { env } from 'cloudflare:workers';
import type { ConnectionInventory } from './connections';
const API = 'https://backend.composio.dev/api/v3.1';
const VERSION = '20260908_00';
type Config = {
  COMPOSIO_API_KEY?: string;
  COMPOSIO_TYPEFULLY_CONNECTED_ACCOUNT_ID?: string;
  COMPOSIO_USER_ID?: string;
};
export async function typefullyConnections(): Promise<ConnectionInventory> {
  const config = env as unknown as Config;
  const result: ConnectionInventory = {
    provider: 'typefully',
    state: 'missing_configuration',
    checkedAt: new Date().toISOString(),
    message: 'Conecta Typefully mediante Composio en el servidor.',
    accounts: [],
    groups: [],
  };
  if (
    !config.COMPOSIO_API_KEY ||
    !config.COMPOSIO_TYPEFULLY_CONNECTED_ACCOUNT_ID ||
    !config.COMPOSIO_USER_ID
  )
    return result;
  const signal = AbortSignal.timeout(20000);
  async function request(
    path: string,
    body?: object,
  ): Promise<Record<string, unknown>> {
    const response = await fetch(API + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        'x-api-key': config.COMPOSIO_API_KEY!,
        'Content-Type': 'application/json',
      },
      signal,
      redirect: 'manual',
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error('Provider request failed');
    const data = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data))
      throw new Error('Invalid provider response');
    return data as Record<string, unknown>;
  }
  async function tool(slug: string, args: object) {
    const response = await request('/tools/execute/' + slug, {
      user_id: config.COMPOSIO_USER_ID,
      connected_account_id: config.COMPOSIO_TYPEFULLY_CONNECTED_ACCOUNT_ID,
      version: VERSION,
      arguments: args,
    });
    if (
      response.successful !== true ||
      !response.data ||
      typeof response.data !== 'object' ||
      Array.isArray(response.data)
    )
      throw new Error('Typefully tool failed');
    return response.data as Record<string, unknown>;
  }
  try {
    const account = await request(
      '/connected_accounts/' +
        encodeURIComponent(config.COMPOSIO_TYPEFULLY_CONNECTED_ACCOUNT_ID),
    );
    const toolkit = account.toolkit as { slug?: string } | undefined;
    if (
      account.id !== config.COMPOSIO_TYPEFULLY_CONNECTED_ACCOUNT_ID ||
      account.status !== 'ACTIVE' ||
      (toolkit?.slug || account.toolkit_slug) !== 'typefully' ||
      (account.user_id || account.userId || account.entity_id) !==
        config.COMPOSIO_USER_ID
    )
      throw new Error('Connection owner or toolkit mismatch');
    const sets: { id: number; name: string }[] = [];
    const seen = new Set<number>();
    let offset = 0;
    let limit = 50;
    while (true) {
      const listing = await tool('TYPEFULLY_LIST_SOCIAL_SETS', {
        limit,
        offset,
      });
      if (!Array.isArray(listing.results))
        throw new Error('Invalid social sets');
      for (const raw of listing.results) {
        const set = raw as { id?: number; name?: string } | null;
        if (
          !set ||
          !Number.isSafeInteger(set.id) ||
          set.id! <= 0 ||
          typeof set.name !== 'string' ||
          seen.has(set.id!)
        )
          throw new Error('Invalid or repeated social set');
        seen.add(set.id!);
        sets.push({ id: set.id!, name: set.name });
      }
      if (listing.next === null || listing.next === undefined) break;
      if (!listing.results.length || typeof listing.next !== 'string')
        throw new Error('Pagination did not advance');
      // Read only pagination arguments. Never send credentials to a returned URL.
      const next = new URL(listing.next);
      const nextOffset = Number(next.searchParams.get('offset'));
      const nextLimit = Number(next.searchParams.get('limit') || 50);
      if (
        next.origin !== 'https://api.typefully.com' ||
        !/^\/v2\/social-sets\/?$/.test(next.pathname) ||
        next.username ||
        next.password ||
        next.hash ||
        !Number.isSafeInteger(nextOffset) ||
        nextOffset !== offset + listing.results.length ||
        !Number.isSafeInteger(nextLimit) ||
        nextLimit < 1 ||
        nextLimit > 50
      )
        throw new Error('Invalid pagination cursor');
      offset = nextOffset;
      limit = nextLimit;
    }
    for (const set of sets) {
      const detail = await tool('TYPEFULLY_GET_SOCIAL_SET', {
        social_set_id: set.id,
      });
      if (
        detail.id !== set.id ||
        !detail.platforms ||
        typeof detail.platforms !== 'object' ||
        Array.isArray(detail.platforms)
      )
        throw new Error('Invalid social set details');
      const ids: string[] = [];
      for (const [channel, rawPlatform] of Object.entries(detail.platforms)) {
        if (!rawPlatform) continue;
        const platform = rawPlatform as { name?: string; username?: string };
        const name = platform.name || platform.username;
        if (typeof name !== 'string' || !name)
          throw new Error('Invalid platform');
        const id = String(set.id) + ':' + channel;
        ids.push(id);
        result.accounts.push({
          id,
          name,
          channel,
          connected: true,
          hidden: false,
        });
      }
      result.groups.push({
        id: String(set.id),
        name: set.name,
        channelIds: ids,
      });
    }
    return {
      ...result,
      state: 'read_verified',
      message:
        'Cuentas consultadas en Typefully mediante Composio. Los permisos y formatos de publicación se validan por separado.',
    };
  } catch {
    return {
      ...result,
      state: 'read_failed',
      accounts: [],
      groups: [],
      message:
        'No se pudo verificar Typefully mediante Composio. Revisa la conexión y vuelve a intentarlo.',
    };
  }
}

// Call only after account discovery and the durable creation claim succeed.
export async function createPrivateTypefullyDraft(args: object) {
  const config = env as unknown as Config;
  if (
    !config.COMPOSIO_API_KEY ||
    !config.COMPOSIO_TYPEFULLY_CONNECTED_ACCOUNT_ID ||
    !config.COMPOSIO_USER_ID
  )
    throw new Error('Missing configuration');
  const response = await fetch(API + '/tools/execute/TYPEFULLY_CREATE_DRAFT', {
    method: 'POST',
    redirect: 'manual',
    signal: AbortSignal.timeout(20000),
    headers: {
      'x-api-key': config.COMPOSIO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: config.COMPOSIO_USER_ID,
      connected_account_id: config.COMPOSIO_TYPEFULLY_CONNECTED_ACCOUNT_ID,
      version: VERSION,
      arguments: args,
    }),
  });
  if (!response.ok) throw new Error('Unconfirmed creation');
  const result = (await response.json()) as {
    successful?: boolean;
    data?: unknown;
  };
  if (result.successful !== true) throw new Error('Unconfirmed creation');
  return result.data;
}
