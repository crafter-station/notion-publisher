/**
 * Content OS config — database ids and property names from env, with
 * live-dump defaults. No secrets.
 */

import {
  CONTENT_OS_BASE_IDS,
  CONTENT_OS_PARENT_PAGE_ENV,
  CONTENT_OS_PARENT_PAGE_ID_DEFAULT,
  CONTENT_OS_PUBLISH_LIVE_ENV,
  ContentOsBaseId,
  PUBLICACION_READY_STATUSES,
  PUBLICACION_READY_STATUSES_ENV,
  SCHEMA_BASES,
  SchemaBaseId,
  SchemaProperty,
} from './schema';

export type ResolvedProperty = SchemaProperty & { resolvedName: string };

export function contentOsDatabaseId(baseId: SchemaBaseId): string {
  const base = SCHEMA_BASES[baseId];
  const fromEnv = (process.env[base.databaseEnvKey] || '').trim();
  return fromEnv || base.defaultDatabaseId;
}

export function contentOsDatabaseIds(): Record<ContentOsBaseId, string> {
  return {
    canales: contentOsDatabaseId('canales'),
    cuentas: contentOsDatabaseId('cuentas'),
    productos: contentOsDatabaseId('productos'),
    piezas: contentOsDatabaseId('piezas'),
    publicaciones: contentOsDatabaseId('publicaciones'),
  };
}

export function contentOsParentPageId(): string {
  return (process.env[CONTENT_OS_PARENT_PAGE_ENV] || '').trim() || CONTENT_OS_PARENT_PAGE_ID_DEFAULT;
}

export function missingContentOsDatabaseEnvKeys(): string[] {
  return CONTENT_OS_BASE_IDS.filter(id => !contentOsDatabaseId(id)).map(
    id => SCHEMA_BASES[id].databaseEnvKey
  );
}

export function propertyName(baseId: SchemaBaseId, key: string): string {
  const prop = SCHEMA_BASES[baseId].properties[key];
  if (!prop) throw new Error(`Unknown schema property ${baseId}.${key}`);
  const override = (process.env[prop.envKey] || '').trim();
  return override || prop.name;
}

export function resolvedProperties(baseId: SchemaBaseId): Record<string, ResolvedProperty> {
  const out: Record<string, ResolvedProperty> = {};
  for (const [key, prop] of Object.entries(SCHEMA_BASES[baseId].properties)) {
    out[key] = { ...prop, resolvedName: propertyName(baseId, key) };
  }
  return out;
}

export function publicacionReadyStatuses(): string[] {
  const raw = (process.env[PUBLICACION_READY_STATUSES_ENV] || '').trim();
  if (!raw) return [...PUBLICACION_READY_STATUSES];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

/** Global live flag. Default off. Never default to true. */
export function contentOsPublishLiveEnabled(): boolean {
  return process.env[CONTENT_OS_PUBLISH_LIVE_ENV] === 'true';
}

export const CANAL_CONECTOR_VALUES = ['Postly', 'Postiz', 'Typefully', 'Composio', 'Nativo'] as const;
export type CanalConectorValue = (typeof CANAL_CONECTOR_VALUES)[number];
