import { env } from 'cloudflare:workers';
import type { ConnectionInventory } from './connections';
import { postizCoverage } from '../postiz-coverage';

export async function postizConnections(): Promise<ConnectionInventory> {
  const config = env as unknown as {
    POSTIZ_API_KEY?: string;
    POSTIZ_API_BASE_URL?: string;
  };
  const result: ConnectionInventory = {
    provider: 'postiz',
    coverage: postizCoverage(null),
    state: 'missing_configuration',
    checkedAt: new Date().toISOString(),
    message:
      'Conecta el servidor Postiz y su clave de API. Instalarlo en tu equipo no lo conecta automáticamente a esta web.',
    accounts: [],
    groups: [],
  };
  if (!config.POSTIZ_API_KEY || !config.POSTIZ_API_BASE_URL) return result;
  try {
    const base = new URL(config.POSTIZ_API_BASE_URL);
    const loopback =
      base.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
    if (
      (!loopback && base.protocol !== 'https:') ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    )
      return {
        ...result,
        message:
          'Revisa la dirección del servidor Postiz: requiere HTTPS; HTTP solo se admite en el entorno local.',
      };
    const response = await fetch(
      base.href.replace(/\/$/, '') + '/integrations',
      {
        headers: {
          Authorization: config.POSTIZ_API_KEY,
          Accept: 'application/json',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok)
      return {
        ...result,
        state: 'read_failed',
        message:
          response.status === 401
            ? 'Postiz rechazó la clave de API. Revisa la conexión.'
            : `Postiz rechazó la consulta (HTTP ${response.status}).`,
      };
    const accounts: unknown = await response.json();
    if (
      !Array.isArray(accounts) ||
      accounts.some(
        (a) =>
          !a ||
          typeof a.id !== 'string' ||
          typeof a.name !== 'string' ||
          typeof a.identifier !== 'string' ||
          typeof a.disabled !== 'boolean',
      )
    )
      throw new Error('Invalid integration inventory');
    return {
      ...result,
      state: 'read_verified',
      coverage: postizCoverage(accounts.map((a) => ({ channel: a.identifier, connected: !a.disabled }))),
      message: accounts.length
        ? 'Cuentas consultadas en Postiz. Los formatos y permisos para publicar se validan por canal.'
        : 'Servidor Postiz verificado. Todavía no tiene cuentas conectadas; añádelas en Postiz.',
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        channel: a.identifier,
        connected: !a.disabled,
        hidden: false,
      })),
    };
  } catch {
    return {
      ...result,
      state: 'read_failed',
      message:
        'No se pudo verificar Postiz. Comprueba que el servidor sea accesible desde Open Publisher.',
    };
  }
}
