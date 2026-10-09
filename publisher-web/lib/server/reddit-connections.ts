import { env } from 'cloudflare:workers';
import type { ConnectionInventory } from './connections';

export async function redditConnections(): Promise<ConnectionInventory> {
  const config = env as unknown as {
    COMPOSIO_API_KEY?: string;
    COMPOSIO_USER_ID?: string;
    COMPOSIO_REDDIT_CONNECTED_ACCOUNT_ID?: string;
  };
  const result: ConnectionInventory = {
    provider: 'reddit',
    state: 'missing_configuration',
    checkedAt: new Date().toISOString(),
    message: 'Conecta Reddit mediante Composio para verificar su lectura.',
    accounts: [],
    groups: [],
  };
  if (!config.COMPOSIO_API_KEY || !config.COMPOSIO_USER_ID) return result;
  const signal = AbortSignal.timeout(20000);
  async function request(path: string, body?: object) {
    const response = await fetch(
      'https://backend.composio.dev/api/v3.1' + path,
      {
        method: body ? 'POST' : 'GET',
        headers: {
          'x-api-key': config.COMPOSIO_API_KEY!,
          'Content-Type': 'application/json',
        },
        signal,
        redirect: 'manual',
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    if (!response.ok) throw new Error('Provider read failed');
    return (await response.json()) as Record<string, unknown>;
  }
  try {
    const listing = await request(
      '/connected_accounts?toolkit_slugs=reddit&limit=100&account_type=ALL',
    );
    if (!Array.isArray(listing.items)) throw new Error('Invalid inventory');
    const accounts = listing.items.filter(
      (a) =>
        a &&
        (a.toolkit?.slug || a.toolkit_slug) === 'reddit' &&
        (a.user_id || a.userId || a.entity_id) === config.COMPOSIO_USER_ID,
    );
    const selected = config.COMPOSIO_REDDIT_CONNECTED_ACCOUNT_ID;
    const candidates = accounts.filter((a) =>
      selected ? a.id === selected : a.status === 'ACTIVE',
    );
    if (listing.next_cursor || candidates.length > 1)
      return {
        ...result,
        message:
          'Selecciona una cuenta de Reddit en la configuración del servidor antes de verificarla.',
      };
    if (candidates.length !== 1 || candidates[0].status !== 'ACTIVE')
      return {
        ...result,
        message:
          'Conecta o reconecta la cuenta de Reddit del usuario configurado en Composio.',
      };
    const account = candidates[0];
    if (typeof account.id !== 'string' || !account.id)
      throw new Error('Invalid account');
    const response = await request(
      '/tools/execute/REDDIT_GET_REDDIT_USER_ABOUT',
      {
        user_id: config.COMPOSIO_USER_ID,
        connected_account_id: account.id,
        version: '20260826_00',
        arguments: { username: 'me' },
      },
    );
    const wrapper = response.data as
      | {
          kind?: unknown;
          data?: { name?: unknown; id?: unknown; is_suspended?: unknown };
        }
      | undefined;
    const data = wrapper?.data;
    if (
      response.successful !== true ||
      wrapper?.kind !== 't2' ||
      typeof data?.id !== 'string' ||
      !data.id ||
      typeof data.name !== 'string' ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(data.name)
    )
      throw new Error('Unverified read');
    return {
      ...result,
      state: 'read_verified',
      message:
        data.is_suspended === true
          ? 'Perfil de Reddit verificado, pero la cuenta está suspendida. Revisa su estado en Reddit.'
          : 'Perfil autenticado de Reddit verificado mediante Composio. Publicación y permisos de cada subreddit pendientes de verificar.',
      accounts: [
        {
          id: account.id,
          name: 'u/' + data.name,
          channel: 'reddit',
          connected: data.is_suspended !== true,
          hidden: false,
        },
      ],
    };
  } catch {
    return {
      ...result,
      state: 'read_failed',
      message:
        'No se pudo verificar la lectura de Reddit. Revisa la autorización de Composio y vuelve a intentarlo.',
    };
  }
}
