/**
 * Channel + account catalog from Notion Canales / Cuentas, with a static
 * fallback when Notion is unavailable (block 4).
 */

import { propertyName } from '../config/content-os';
import { createPropertyReader } from '../readers/props';
import type { NotionTransport } from '../readers/notion-transport';

export type CatalogCanal = {
  id: string;
  nombre: string;
  conector: string;
  estadoDelConector: string;
  familia: string;
  settingsRequeridos: string;
};

export type CatalogCuenta = {
  id: string;
  nombre: string;
  estado: string;
  conector: string;
  handle: string;
  integrationId: string;
  marca: string;
  canalIds: string[];
};

export type ChannelAccountCatalog = {
  source: 'notion' | 'static';
  canales: CatalogCanal[];
  cuentas: CatalogCuenta[];
};

export const STATIC_CANALES: CatalogCanal[] = [
  { id: 'static-instagram', nombre: 'Instagram', conector: 'Postly', estadoDelConector: 'live', familia: 'Social', settingsRequeridos: '' },
  { id: 'static-x', nombre: 'X', conector: 'Typefully', estadoDelConector: 'dry-run', familia: 'Social', settingsRequeridos: '' },
  { id: 'static-discord', nombre: 'Discord', conector: 'Postiz', estadoDelConector: 'dry-run', familia: 'Mensajería', settingsRequeridos: 'channel' },
  { id: 'static-reddit', nombre: 'Reddit', conector: 'Composio', estadoDelConector: 'dry-run', familia: 'Social', settingsRequeridos: 'subreddit' },
  { id: 'static-eventbrite', nombre: 'Eventbrite', conector: 'Composio', estadoDelConector: 'dry-run', familia: 'Eventos', settingsRequeridos: '' },
  { id: 'static-gumroad', nombre: 'Gumroad', conector: 'Nativo', estadoDelConector: 'live', familia: 'Productos', settingsRequeridos: '' },
  { id: 'static-github', nombre: 'GitHub', conector: 'Nativo', estadoDelConector: 'live', familia: 'Código', settingsRequeridos: '' },
  { id: 'static-luma', nombre: 'Luma', conector: 'Nativo', estadoDelConector: 'live', familia: 'Eventos', settingsRequeridos: '' },
  { id: 'static-restream', nombre: 'Restream', conector: 'Nativo', estadoDelConector: 'dry-run', familia: 'Live', settingsRequeridos: '' },
];

export const STATIC_CUENTAS: CatalogCuenta[] = STATIC_CANALES.map(c => ({
  id: `static-cuenta-${c.id}`,
  nombre: `${c.nombre} (static)`,
  estado: 'Activa',
  conector: c.conector,
  handle: '',
  integrationId: '',
  marca: 'nebulabs',
  canalIds: [c.id],
}));

function parseCanal(page: any): CatalogCanal {
  const r = createPropertyReader(page.properties || {});
  return {
    id: page.id,
    nombre: r.title(propertyName('canales', 'nombre')),
    conector: r.select(propertyName('canales', 'conector')),
    estadoDelConector: r.select(propertyName('canales', 'estadoDelConector')),
    familia: r.select(propertyName('canales', 'familia')),
    settingsRequeridos: r.richText(propertyName('canales', 'settingsRequeridos')),
  };
}

function parseCuenta(page: any): CatalogCuenta {
  const r = createPropertyReader(page.properties || {});
  return {
    id: page.id,
    nombre: r.title(propertyName('cuentas', 'cuenta')),
    estado: r.select(propertyName('cuentas', 'estado')),
    conector: r.select(propertyName('cuentas', 'conector')),
    handle: r.richText(propertyName('cuentas', 'handle')),
    integrationId: r.richText(propertyName('cuentas', 'idDeIntegracion')),
    marca: r.select(propertyName('cuentas', 'marca')),
    canalIds: r.relationIds(propertyName('cuentas', 'canal')),
  };
}

export async function loadChannelAccountCatalog(
  transport: NotionTransport,
  ids: { canales: string; cuentas: string },
  options: { allowStaticFallback?: boolean } = {}
): Promise<ChannelAccountCatalog> {
  const allowStatic = options.allowStaticFallback !== false;
  if (!ids.canales || !ids.cuentas) {
    if (!allowStatic) return { source: 'notion', canales: [], cuentas: [] };
    return { source: 'static', canales: STATIC_CANALES, cuentas: STATIC_CUENTAS };
  }
  try {
    const [canales, cuentas] = await Promise.all([
      transport.queryAll(ids.canales),
      transport.queryAll(ids.cuentas),
    ]);
    if (!canales.length && !cuentas.length) {
      if (!allowStatic) return { source: 'notion', canales: [], cuentas: [] };
      return { source: 'static', canales: STATIC_CANALES, cuentas: STATIC_CUENTAS };
    }
    return {
      source: 'notion',
      canales: canales.map(parseCanal),
      cuentas: cuentas.map(parseCuenta),
    };
  } catch (err: any) {
    if (!allowStatic) throw err;
    console.warn(`[CATALOG] Notion read failed, using static fallback: ${err.message}`);
    return { source: 'static', canales: STATIC_CANALES, cuentas: STATIC_CUENTAS };
  }
}

export function cuentasForCanal(catalog: ChannelAccountCatalog, canalId: string): CatalogCuenta[] {
  return catalog.cuentas.filter(c => c.canalIds.includes(canalId) && c.estado === 'Activa');
}

/** Match resolved channel/source names to Activa cuentas. Fallback: all Activa. */
export function selectTargetCuentas(
  catalog: ChannelAccountCatalog,
  names: string[]
): CatalogCuenta[] {
  const activa = catalog.cuentas.filter(c => c.estado === 'Activa');
  const wanted = new Set(names.map(n => n.trim().toLowerCase()).filter(Boolean));
  if (!wanted.size) return activa;
  const canalIds = new Set(
    catalog.canales
      .filter(
        c =>
          wanted.has(c.nombre.toLowerCase()) ||
          wanted.has(c.conector.toLowerCase()) ||
          wanted.has(c.familia.toLowerCase())
      )
      .map(c => c.id)
  );
  const matched = activa.filter(c => c.canalIds.some(id => canalIds.has(id)));
  return matched.length ? matched : activa;
}
