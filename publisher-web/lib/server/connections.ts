import { env } from 'cloudflare:workers';
import type { PostizCoverage } from '../postiz-coverage';
export type ConnectionInventory = {
  provider: string;
  state:
    | 'read_verified'
    | 'missing_configuration'
    | 'read_failed'
    | 'subscription_required';
  checkedAt: string;
  coverage?: PostizCoverage;
  message: string;
  accounts: {
    id: string;
    name: string;
    channel: string;
    connected: boolean;
    hidden: boolean;
  }[];
  groups: { id: string; name: string; channelIds: string[] }[];
};
export async function postlyConnections(): Promise<ConnectionInventory> {
  const config = env as unknown as {
    POSTLY_API_KEY?: string;
    POSTLY_WORKSPACE_ID?: string;
  };
  const result: ConnectionInventory = {
    provider: 'postly',
    state: 'missing_configuration',
    checkedAt: new Date().toISOString(),
    message: 'Configura la conexión de Postly en el servidor.',
    accounts: [],
    groups: [],
  };
  if (!config.POSTLY_API_KEY || !config.POSTLY_WORKSPACE_ID) return result;
  try {
    const response = await fetch(
      'https://openapi.postly.ai/v1/workspaces/' +
        encodeURIComponent(config.POSTLY_WORKSPACE_ID) +
        '/socials',
      {
        headers: { 'X-API-Key': config.POSTLY_API_KEY },
        redirect: 'manual',
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok)
      return {
        ...result,
        state: 'read_failed',
        message: `Postly rechazó la consulta (HTTP ${response.status}).`,
      };
    const body = (await response.json()) as {
      data?: Record<string, unknown>[];
    };
    if (!Array.isArray(body.data))
      return {
        ...result,
        state: 'read_failed',
        message: 'Postly devolvió una respuesta inesperada.',
      };
    for (const item of body.data) {
      if (typeof item.id !== 'string' || typeof item.name !== 'string')
        continue;
      if (typeof item.target === 'string')
        result.accounts.push({
          id: item.id,
          name: item.name,
          channel: item.target,
          connected: item.connected === true,
          hidden: item.hidden === true,
        });
      else if (
        typeof item.audience_group_id === 'string' &&
        Array.isArray(item.channel_ids)
      )
        result.groups.push({
          id: item.audience_group_id,
          name: item.name,
          channelIds: item.channel_ids.filter(
            (id): id is string => typeof id === 'string',
          ),
        });
    }
    return {
      ...result,
      state: 'read_verified',
      message:
        'Cuentas consultadas en Postly. La capacidad de publicar requiere validación por cuenta y canal.',
    };
  } catch {
    return {
      ...result,
      state: 'read_failed',
      message: 'No se pudo contactar con Postly. Inténtalo de nuevo.',
    };
  }
}

export async function identityConnections(
  provider: 'gumroad' | 'luma' | 'github' | 'skool',
): Promise<ConnectionInventory> {
  const config = env as unknown as Record<string, string | undefined>;
  const keys = {
    gumroad: 'GUMROAD_TOKEN',
    luma: 'LUMA_API_KEY',
    github: 'GITHUB_TOKEN',
    skool: 'SKOOL_API_KEY',
  };
  const names = {
    gumroad: 'Gumroad',
    luma: 'Luma',
    github: 'GitHub',
    skool: 'Skool',
  };
  const result: ConnectionInventory = {
    provider,
    state: 'missing_configuration',
    checkedAt: new Date().toISOString(),
    message: `Configura la conexión de ${names[provider]} en el servidor.`,
    accounts: [],
    groups: [],
  };
  const token = config[keys[provider]];
  if (!token) return result;
  const urls = {
    gumroad:
      'https://api.gumroad.com/v2/user?' +
      new URLSearchParams({ access_token: token }),
    luma: 'https://public-api.luma.com/v1/users/get-self',
    github: 'https://api.github.com/user',
    skool: 'https://api.myskool.xyz/v1/groups',
  };
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (provider === 'luma') headers['x-luma-api-key'] = token;
  else if (provider !== 'gumroad') headers.Authorization = 'Bearer ' + token;
  if (provider === 'github') headers['User-Agent'] = 'Open-Publisher';
  try {
    const response = await fetch(urls[provider], {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
    });
    if (provider === 'skool' && response.status === 402)
      return {
        ...result,
        state: 'subscription_required',
        message:
          'MySkool requiere una suscripción activa para consultar los grupos. Revisa el plan en myskool.xyz/billing.',
      };
    if (!response.ok)
      return {
        ...result,
        state: 'read_failed',
        message: `${names[provider]} rechazó la consulta (HTTP ${response.status}).`,
      };
    const data = (await response.json()) as Record<string, unknown>;
    if (
      !data ||
      typeof data !== 'object' ||
      (provider === 'gumroad' && data.success !== true)
    )
      throw new Error('Invalid provider response');
    const records =
      provider === 'skool'
        ? data.data
        : [provider === 'gumroad' ? data.user : data];
    if (!Array.isArray(records)) throw new Error('Invalid provider response');
    for (const raw of records) {
      if (!raw || typeof raw !== 'object') throw new Error('Invalid account');
      const account = raw as Record<string, unknown>;
      const id = account.id;
      const name = provider === 'github' ? account.login : account.name;
      if (
        (typeof id !== 'string' && typeof id !== 'number') ||
        typeof name !== 'string'
      )
        throw new Error('Invalid account');
      result.accounts.push({
        id: String(id),
        name,
        channel: provider,
        connected: true,
        hidden: false,
      });
    }
    return {
      ...result,
      state: 'read_verified',
      message:
        provider === 'skool'
          ? 'Grupos consultados mediante MySkool. La publicación todavía no está implementada.'
          : `Identidad verificada en ${names[provider]}. Los permisos para publicar se comprueban por separado.`,
    };
  } catch {
    return {
      ...result,
      accounts: [],
      state: 'read_failed',
      message: `No se pudo verificar la respuesta de ${names[provider]}. Inténtalo de nuevo.`,
    };
  }
}
