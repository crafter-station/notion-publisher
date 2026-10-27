/**
 * Map legacy Publisher rows (or a snapshot JSON) to 🧩 Piezas + 🚀 Publicaciones.
 * --dry-run is the default. Idempotent via Clave de idempotencia on each Pieza.
 */

import { CatalogCanal, CatalogCuenta, ChannelAccountCatalog } from '../catalog/channels';
import { listDeclaredPropertyNames } from '../config/schema';
import { propertyName } from '../config/content-os';
import { parsePieza, parsePublicacion } from '../readers/content-os.reader';
import { createPropertyReader } from '../readers/props';
import type { NotionTransport } from '../readers/notion-transport';
import { applyOptionalPiezaDesignFields, applyOptionalPublicacionImageVersion } from './content-os-fields';

export type LegacyPublisherRow = {
  id: string;
  properties?: Record<string, any>;
  fields?: Record<string, string | number | undefined>;
  title?: string;
  sources?: string[];
  channels?: string[];
  layer?: string;
  status?: string;
  url?: string;
  archived?: boolean;
  inTrash?: boolean;
};

export type MigrationTarget = {
  hint: string;
  conector: string;
  familia?: string;
  canalNombre?: string;
  canalId?: string;
};

export type LayerCounts = {
  rows: number;
  piezas_would_create: number;
  publicaciones_would_create: number;
  publicaciones_expected: number;
};

export type IgnoredColumn = { name: string; reason: string };

export type MigrationReport = {
  dry_run: boolean;
  status: 'ok' | 'error';
  source_rows: number;
  processed_rows: number;
  piezas: { would_create: number; skipped_existing: number; created: number };
  publicaciones: {
    would_create: number;
    skipped_existing: number;
    created: number;
    expected: number;
  };
  layers: Record<string, LayerCounts>;
  missing_cuentas: string[];
  unmatched_channels: string[];
  unknown_columns: string[];
  ignored_columns: IgnoredColumn[];
  warnings: string[];
  errors: string[];
  excluded: { archived: number; by_id: number; by_url: number; total: number };
};

/** Flat snapshot keys we accept (case-insensitive). Everything else is reported. */
export const FLAT_SNAPSHOT_KEYS = [
  'page_id',
  'page id',
  'id',
  'notion_page_id',
  'notion page id',
  'name',
  'title',
  'layer',
  'channels',
  'caption',
  'source tags',
  'sources',
  'source',
  'status',
  'url',
  'urls',
  'page_url',
  'page url',
  'archived',
  'in_trash',
  'in trash',
  'fields',
  'properties',
  'props',
] as const;

const CHANNEL_ALIASES: Record<string, string> = {
  instagram: 'Instagram',
  ig: 'Instagram',
  x: 'X',
  twitter: 'X',
  twitterx: 'X',
  discord: 'Discord',
  reddit: 'Reddit',
  eventbrite: 'Eventbrite',
  gumroad: 'Gumroad',
  github: 'GitHub',
  luma: 'Luma',
  restream: 'Restream',
};

export function normalizeChannelToken(raw: string): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function canonicalChannelName(raw: string): string {
  const token = normalizeChannelToken(raw);
  return CHANNEL_ALIASES[token] || String(raw || '').trim();
}

export function isNumericTitle(title: string): boolean {
  return /^\d+$/.test(String(title || '').trim());
}

function emptyLayerCounts(): LayerCounts {
  return { rows: 0, piezas_would_create: 0, publicaciones_would_create: 0, publicaciones_expected: 0 };
}

function finalizeReport(report: MigrationReport): MigrationReport {
  report.processed_rows = Math.max(0, report.source_rows - report.excluded.total);
  return report;
}

function emptyReport(dryRun: boolean, sourceRows: number): MigrationReport {
  return {
    dry_run: dryRun,
    status: 'ok',
    source_rows: sourceRows,
    processed_rows: 0,
    piezas: { would_create: 0, skipped_existing: 0, created: 0 },
    publicaciones: { would_create: 0, skipped_existing: 0, created: 0, expected: 0 },
    layers: {},
    missing_cuentas: [],
    unmatched_channels: [],
    unknown_columns: [],
    ignored_columns: [],
    warnings: [],
    errors: [],
    excluded: { archived: 0, by_id: 0, by_url: 0, total: 0 },
  };
}

function layerBucket(row: LegacyPublisherRow): string {
  const n = normalizeChannelToken(row.layer || '');
  if (n === 'products' || n === 'product' || n === 'producto' || n === 'productos') return 'Products';
  if (n === 'social') return 'Social';
  if (n === 'events' || n === 'event' || n === 'evento' || n === 'eventos') return 'Events';
  return row.layer?.trim() || 'Other';
}

function ensureLayer(report: MigrationReport, layer: string): LayerCounts {
  if (!report.layers[layer]) report.layers[layer] = emptyLayerCounts();
  return report.layers[layer];
}

function pushUnique(list: string[], value: string): void {
  if (value && !list.includes(value)) list.push(value);
}

export function cleanChannelName(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/^[\s"'`\[\]]+|[\s"'`\[\]]+$/g, '')
    .replace(/["'`[\]]/g, '')
    .trim();
}

/** Parse Channels from a real array, a JSON-array string, or a comma/semicolon list. */
export function parseChannelList(value: unknown): string[] {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) {
    return value.flatMap(v => parseChannelList(v));
  }
  if (typeof value === 'object') {
    const o = value as any;
    if (o.name) return [cleanChannelName(String(o.name))].filter(Boolean);
    if (Array.isArray(o.multi_select)) {
      return o.multi_select.map((x: any) => cleanChannelName(String(x?.name || ''))).filter(Boolean);
    }
  }
  const text = String(value).trim();
  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parseChannelList(parsed);
    } catch {
      // malformed bracket string → fallback split
    }
  }
  return text
    .split(/[,;]/)
    .map(s => cleanChannelName(s))
    .filter(Boolean);
}

function lowerKeyMap(row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key == null) continue;
    out[String(key).trim().toLowerCase()] = value;
  }
  return out;
}

function knownFlatKeySet(): Set<string> {
  const known = new Set<string>(FLAT_SNAPSHOT_KEYS);
  for (const name of listDeclaredPropertyNames()) known.add(name.trim().toLowerCase());
  return known;
}

/**
 * Explicit snapshot columns that are either aliases of a schema property
 * or leftover Publisher exports that must not appear as unknown.
 */
export const SNAPSHOT_COLUMN_HANDLERS: Record<string, { mapsTo?: string; ignoreReason?: string }> = {
  page_url: { mapsTo: 'url' },
  'page url': { mapsTo: 'url' },
  'Postly Error': { mapsTo: 'Error' },
  'Eventbrite Event ID': {
    ignoreReason:
      'legacy Publisher column; no matching schema property (Eventbrite Organization ID / Venue ID / URL are declared; migrate does not persist Eventbrite event ids)',
  },
};

function handlerForColumn(name: string): { mapsTo?: string; ignoreReason?: string } | undefined {
  if (SNAPSHOT_COLUMN_HANDLERS[name]) return SNAPSHOT_COLUMN_HANDLERS[name];
  const lower = name.trim().toLowerCase();
  for (const [key, handler] of Object.entries(SNAPSHOT_COLUMN_HANDLERS)) {
    if (key.toLowerCase() === lower) return handler;
  }
  return undefined;
}

function isKnownColumnName(name: string, known: Set<string>): boolean {
  return known.has(name.trim().toLowerCase());
}

export function classifySnapshotColumns(raw: unknown): {
  unknown: string[];
  ignored: IgnoredColumn[];
  mapped: Array<{ name: string; mapsTo: string }>;
} {
  const rows = extractRawRows(raw);
  const known = knownFlatKeySet();
  const unknown = new Set<string>();
  const ignored = new Map<string, string>();
  const mapped = new Map<string, string>();

  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    if (row.properties && typeof row.properties === 'object') continue;
    for (const key of Object.keys(row)) {
      const trimmed = key.trim();
      if (isKnownColumnName(trimmed, known)) continue;
      const handler = handlerForColumn(trimmed);
      if (handler?.mapsTo) {
        if (isKnownColumnName(handler.mapsTo, known)) {
          mapped.set(trimmed, handler.mapsTo);
          continue;
        }
        ignored.set(
          trimmed,
          `alias of ${handler.mapsTo}, but that property is not in the schema`
        );
        continue;
      }
      if (handler?.ignoreReason) {
        ignored.set(trimmed, handler.ignoreReason);
        continue;
      }
      unknown.add(trimmed);
    }
  }

  return {
    unknown: [...unknown].sort((a, b) => a.localeCompare(b)),
    ignored: [...ignored.entries()]
      .map(([name, reason]) => ({ name, reason }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    mapped: [...mapped.entries()]
      .map(([name, mapsTo]) => ({ name, mapsTo }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export function listSnapshotUnknownColumns(raw: unknown): string[] {
  return classifySnapshotColumns(raw).unknown;
}

function extractRawRows(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const o = raw as any;
    if (Array.isArray(o.pages)) return o.pages;
    if (Array.isArray(o.results)) return o.results;
    if (Array.isArray(o.rows)) return o.rows;
  }
  throw new Error('Snapshot must be an array or { pages|results|rows: [] }');
}

export function loadPublisherSnapshot(raw: unknown): LegacyPublisherRow[] {
  return extractRawRows(raw).map(normalizeRow);
}

function normalizeRow(row: any): LegacyPublisherRow {
  if (!row || typeof row !== 'object') throw new Error('Invalid snapshot row');
  if (row.properties && typeof row.properties === 'object' && !Array.isArray(row.properties)) {
    return {
      id: String(row.id || row.page_id || row.notion_page_id || ''),
      properties: row.properties || row.props || {},
      fields: row.fields,
      title: row.title,
      sources: row.sources,
      channels: row.channels ? parseChannelList(row.channels) : undefined,
      layer: row.layer,
      status: row.status,
      url: row.url || row.page_url,
      archived: row.archived === true || row.in_trash === true,
      inTrash: row.in_trash === true || row.inTrash === true,
    };
  }
  const flat = lowerKeyMap(row);
  const id = String(flat.page_id || flat['page id'] || flat.id || flat.notion_page_id || flat['notion page id'] || '');
  const title = firstText(flat.name, flat.title);
  const caption = firstText(flat.caption);
  const layer = firstText(flat.layer);
  const channels = parseChannelList(flat.channels);
  const sources = parseChannelList(flat['source tags'] ?? flat.sources ?? flat.source);
  const fields: Record<string, string | number | undefined> = { ...(row.fields || {}) };
  if (caption) fields.Caption = caption;
  if (title) fields.Name = title;
  return {
    id,
    properties: {},
    fields,
    title: title || undefined,
    sources: sources.length ? sources : undefined,
    channels: channels.length ? channels : undefined,
    layer: layer || undefined,
    status: firstText(flat.status) || undefined,
    url: firstText(flat.url, flat.urls, flat.page_url, flat['page url']) || undefined,
    archived: truthyFlag(flat.archived),
    inTrash: truthyFlag(flat.in_trash) || truthyFlag(flat['in trash']),
  };
}

function truthyFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  const s = String(value ?? '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (value == null || value === '') continue;
    const s = String(value).trim();
    if (s) return s;
  }
  return '';
}

function rowChannels(row: LegacyPublisherRow): string[] {
  const r = createPropertyReader(row.properties || {});
  const fromRow = row.channels || [];
  const fromProps = r.multiSelect('Channels').concat(r.multiSelect('Postiz Targets'));
  return [...fromRow, ...fromProps].map(s => cleanChannelName(String(s))).filter(Boolean);
}

function rowSources(row: LegacyPublisherRow): string[] {
  const r = createPropertyReader(row.properties || {});
  return (row.sources || r.multiSelect('Source Tags')).map(s => String(s).trim()).filter(Boolean);
}

function rowLayer(row: LegacyPublisherRow): string {
  const r = createPropertyReader(row.properties || {});
  return row.layer || r.select('Layer') || '';
}

export function findCanalByName(
  catalog: ChannelAccountCatalog,
  rawName: string
): CatalogCanal | undefined {
  const token = normalizeChannelToken(rawName);
  const canonical = CHANNEL_ALIASES[token];
  const wanted = new Set([token, canonical ? normalizeChannelToken(canonical) : ''].filter(Boolean));
  return catalog.canales.find(ch => wanted.has(normalizeChannelToken(ch.nombre)));
}

function targetFromCanal(canal: CatalogCanal): MigrationTarget {
  return {
    hint: canal.conector === 'Nativo' ? `Nativo:${canal.familia}` : canal.nombre,
    conector: canal.conector,
    familia: canal.familia,
    canalNombre: canal.nombre,
    canalId: canal.id,
  };
}

function canalByFamilia(catalog: ChannelAccountCatalog, conector: string, familia: string): CatalogCanal | undefined {
  return catalog.canales.find(ch => ch.conector === conector && ch.familia === familia);
}

export function inferTargets(
  row: LegacyPublisherRow,
  catalog: ChannelAccountCatalog
): { targets: MigrationTarget[]; unmatched: string[] } {
  const unmatched: string[] = [];
  const byId = new Map<string, MigrationTarget>();
  const add = (target: MigrationTarget) => {
    const id = target.canalId || `${target.conector}:${target.familia || ''}:${target.hint}`;
    if (!byId.has(id)) byId.set(id, target);
  };

  const channels = rowChannels(row);
  for (const name of channels) {
    const canal = findCanalByName(catalog, name);
    if (!canal) {
      pushUnique(unmatched, cleanChannelName(name));
      continue;
    }
    add(targetFromCanal(canal));
  }
  if (channels.length) return { targets: [...byId.values()], unmatched };

  const layer = layerBucket({ ...row, layer: rowLayer(row) });
  if (layer === 'Products') {
    const canal = findCanalByName(catalog, 'Gumroad') || canalByFamilia(catalog, 'Nativo', 'Productos');
    if (canal) add(targetFromCanal(canal));
    return { targets: [...byId.values()], unmatched };
  }
  if (layer === 'Events') {
    const canal = findCanalByName(catalog, 'Luma') || canalByFamilia(catalog, 'Nativo', 'Eventos');
    if (canal) add(targetFromCanal(canal));
    return { targets: [...byId.values()], unmatched };
  }

  const tags = rowSources(row);
  const r = createPropertyReader(row.properties || {});
  const blob = [...tags, layer].join(' ').toLowerCase();
  const tagMap: Array<[string, string, string?]> = [
    ['Gumroad', 'Nativo', 'Productos'],
    ['GitHub', 'Nativo', 'Código'],
    ['Luma', 'Nativo', 'Eventos'],
  ];
  for (const [tag, conector, familia] of tagMap) {
    if (tags.includes(tag)) {
      const canal = familia
        ? canalByFamilia(catalog, conector, familia)
        : catalog.canales.find(ch => ch.conector === conector);
      if (canal) add(targetFromCanal(canal));
    }
  }
  if (tags.includes('Reddit') || tags.includes('Composio')) {
    const canal = findCanalByName(catalog, 'Reddit');
    if (canal) add(targetFromCanal(canal));
  }
  if (tags.includes('Eventbrite')) {
    const canal = findCanalByName(catalog, 'Eventbrite');
    if (canal) add(targetFromCanal(canal));
  }
  if (r.richText('Restream Title') || /restream/.test(blob)) {
    const canal = findCanalByName(catalog, 'Restream') || canalByFamilia(catalog, 'Nativo', 'Live');
    if (canal) add(targetFromCanal(canal));
  }
  if (r.richText('Typefully Account') || r.richText('Typefully Thread') || tags.includes('Typefully')) {
    for (const canal of catalog.canales.filter(ch => ch.conector === 'Typefully')) add(targetFromCanal(canal));
  }
  if (r.multiSelect('Postiz Targets').length || tags.includes('Postiz')) {
    for (const canal of catalog.canales.filter(ch => ch.conector === 'Postiz')) add(targetFromCanal(canal));
  }
  if (tags.includes('Postly')) {
    for (const canal of catalog.canales.filter(ch => ch.conector === 'Postly')) add(targetFromCanal(canal));
  }

  return { targets: [...byId.values()], unmatched };
}

export function rowTitle(row: LegacyPublisherRow): string {
  const r = createPropertyReader(row.properties || {});
  return (
    row.title ||
    firstText(row.fields?.Name, row.fields?.name) ||
    r.title('Name') ||
    r.richText('Caption') ||
    firstText(row.fields?.Caption) ||
    r.richText('Gumroad Title') ||
    `publisher-${row.id.slice(0, 8) || 'row'}`
  );
}

export function piezaKey(row: LegacyPublisherRow): string {
  return `publisher:${row.id}`;
}

export function publicacionKey(row: LegacyPublisherRow, connectorHint: string): string {
  return `publisher:${row.id}:${connectorHint}`;
}

export async function loadExistingIdempotencyKeys(
  transport: NotionTransport,
  publicacionesId: string
): Promise<Set<string>> {
  const pages = await transport.queryAll(publicacionesId);
  const keys = new Set<string>();
  for (const page of pages) {
    const pub = parsePublicacion(page);
    if (pub.claveDeIdempotencia) keys.add(pub.claveDeIdempotencia);
  }
  return keys;
}

export async function loadExistingPiezaKeys(
  transport: NotionTransport,
  piezasId: string
): Promise<Set<string>> {
  const pages = await transport.queryAll(piezasId);
  const keys = new Set<string>();
  for (const page of pages) {
    const pieza = parsePieza(page);
    if (pieza.claveDeIdempotencia) keys.add(pieza.claveDeIdempotencia);
  }
  return keys;
}

const ARCHIVED_STATUS = new Set(['archived', 'archivado', 'archive', 'in_trash', 'in trash', 'trash', 'deleted']);

export function isArchivedRow(row: LegacyPublisherRow): boolean {
  if (row.archived || row.inTrash) return true;
  const r = createPropertyReader(row.properties || {});
  const status = String(row.status || r.status('Status') || r.select('Status') || '').trim().toLowerCase();
  if (ARCHIVED_STATUS.has(status)) return true;
  const archivedProp = row.fields?.archived ?? row.fields?.in_trash ?? row.properties?.archived ?? row.properties?.in_trash;
  return truthyFlag(archivedProp);
}

export function normalizeNotionRef(raw: string): string {
  const text = String(raw || '').trim();
  if (!text) return '';
  const dashed = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (dashed) return dashed[0].replace(/-/g, '').toLowerCase();
  const compact = text.replace(/-/g, '').match(/[0-9a-f]{32}/i);
  if (compact) return compact[0].toLowerCase();
  return text.toLowerCase();
}

export function buildExcludeSet(refs: string[]): Set<string> {
  const out = new Set<string>();
  for (const ref of refs) {
    const trimmed = String(ref || '').trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    out.add(trimmed);
    out.add(trimmed.toLowerCase());
    const id = normalizeNotionRef(trimmed);
    if (id) out.add(id);
  }
  return out;
}

function rowMatchesExclude(row: LegacyPublisherRow, exclude: Set<string>): 'id' | 'url' | null {
  if (!exclude.size) return null;
  const idKeys = [row.id, normalizeNotionRef(row.id)].filter(Boolean);
  if (idKeys.some(k => exclude.has(k) || exclude.has(k.toLowerCase()))) return 'id';
  const url = row.url || firstText(row.fields?.url, row.fields?.URL);
  if (url && (exclude.has(url) || exclude.has(url.toLowerCase()) || exclude.has(normalizeNotionRef(url)))) {
    return 'url';
  }
  return null;
}

/** Activa cuentas linked to the target canal — never every cuenta that shares a Conector. */
export function matchCuentas(catalog: ChannelAccountCatalog, target: MigrationTarget | string): CatalogCuenta[] {
  const resolved: MigrationTarget =
    typeof target === 'string' ? { hint: target, conector: target.split(':')[0], familia: target.split(':')[1] } : target;
  return catalog.cuentas.filter(c => {
    if (c.estado !== 'Activa') return false;
    const canals = catalog.canales.filter(ch => c.canalIds.includes(ch.id));
    if (resolved.canalId) return canals.some(ch => ch.id === resolved.canalId);
    if (resolved.canalNombre) {
      return canals.some(ch => normalizeChannelToken(ch.nombre) === normalizeChannelToken(resolved.canalNombre!));
    }
    if (resolved.familia) {
      return canals.some(ch => ch.conector === resolved.conector && ch.familia === resolved.familia);
    }
    return canals.some(ch => ch.conector === resolved.conector);
  });
}

function catalogHasStaticIds(catalog: ChannelAccountCatalog): boolean {
  return (
    catalog.canales.some(c => c.id.startsWith('static-')) ||
    catalog.cuentas.some(c => c.id.startsWith('static-'))
  );
}

function activaCuentas(catalog: ChannelAccountCatalog): CatalogCuenta[] {
  return catalog.cuentas.filter(c => c.estado === 'Activa');
}

export async function migrateContentOs(options: {
  rows: LegacyPublisherRow[];
  catalog: ChannelAccountCatalog;
  transport: NotionTransport;
  ids: { piezas: string; publicaciones: string };
  dryRun: boolean;
  existingKeys?: Set<string>;
  existingPiezaKeys?: Set<string>;
  excludeIds?: string[];
  excludeUrls?: string[];
  offline?: boolean;
  unknownColumns?: string[];
  ignoredColumns?: IgnoredColumn[];
}): Promise<MigrationReport> {
  const report = emptyReport(options.dryRun, options.rows.length);
  report.unknown_columns = [...(options.unknownColumns || [])];
  report.ignored_columns = [...(options.ignoredColumns || [])];

  const existingPubs = new Set(options.existingKeys || []);
  const existingPiezas = new Set(options.existingPiezaKeys || []);
  for (const key of existingPubs) {
    if (/^publisher:[^:]+$/.test(key)) existingPiezas.add(key);
  }
  const excludeIds = buildExcludeSet(options.excludeIds || []);
  const excludeUrls = buildExcludeSet(options.excludeUrls || []);

  if (!activaCuentas(options.catalog).length) {
    report.status = 'error';
    report.errors.push(
      'Cuentas catalog is empty (or has no Activa rows). Refusing to create Piezas without a Cuenta to attach Publicaciones.'
    );
    return finalizeReport(report);
  }

  if (options.offline === false && catalogHasStaticIds(options.catalog)) {
    report.status = 'error';
    report.errors.push(
      'static-* Canal/Cuenta ids are only valid in --offline mode. A live run needs real Notion Cuentas.'
    );
    return finalizeReport(report);
  }

  for (const row of options.rows) {
    if (isArchivedRow(row)) {
      report.excluded.archived += 1;
      report.excluded.total += 1;
      continue;
    }
    if (rowMatchesExclude(row, excludeIds)) {
      report.excluded.by_id += 1;
      report.excluded.total += 1;
      continue;
    }
    if (rowMatchesExclude(row, excludeUrls)) {
      report.excluded.by_url += 1;
      report.excluded.total += 1;
      continue;
    }
    if (!row.id) {
      report.status = 'error';
      report.errors.push('row missing id');
      continue;
    }
    const layer = layerBucket({ ...row, layer: rowLayer(row) });
    const counts = ensureLayer(report, layer);
    counts.rows += 1;

    const title = rowTitle(row);
    if (isNumericTitle(title)) {
      report.warnings.push(`numeric_title: page_id=${row.id} title=${title}`);
    }

    const { targets, unmatched } = inferTargets(row, options.catalog);
    for (const name of unmatched) pushUnique(report.unmatched_channels, name);

    const resolved = targets
      .map(target => ({ target, cuentas: matchCuentas(options.catalog, target) }))
      .filter(x => x.cuentas.length);

    if (!resolved.length) {
      report.status = 'error';
      const detail = unmatched.length
        ? `unmatched channels: ${unmatched.join(', ')}`
        : 'no Cuenta resolves for this row channel/layer';
      report.errors.push(`page_id=${row.id}: ${detail}`);
      for (const target of targets) pushUnique(report.missing_cuentas, target.hint);
      continue;
    }

    const expectedPubs = resolved.reduce((n, x) => n + x.cuentas.length, 0);
    counts.publicaciones_expected += expectedPubs;
    report.publicaciones.expected += expectedPubs;

    const pKey = piezaKey(row);
    let piezaId: string | undefined;
    if (existingPiezas.has(pKey)) {
      report.piezas.skipped_existing += 1;
    } else if (options.dryRun) {
      report.piezas.would_create += 1;
      counts.piezas_would_create += 1;
      existingPiezas.add(pKey);
    } else {
      const piezaProps: Record<string, unknown> = {
        [propertyName('piezas', 'nombre')]: { title: [{ text: { content: title.slice(0, 2000) } }] },
        [propertyName('piezas', 'status')]: { status: { name: 'Lista' } },
        [propertyName('piezas', 'claveDeIdempotencia')]: {
          rich_text: [{ text: { content: pKey } }],
        },
        [propertyName('piezas', 'captionBase')]: {
          rich_text: [{ text: { content: (firstText(row.fields?.Caption) || title).slice(0, 2000) } }],
        },
      };
      applyOptionalPiezaDesignFields(piezaProps, { properties: row.properties, fields: row.fields });
      const created = await options.transport.createPage(options.ids.piezas, piezaProps);
      piezaId = created.id;
      existingPiezas.add(pKey);
      report.piezas.created += 1;
    }

    for (const { target, cuentas } of resolved) {
      for (const cuenta of cuentas) {
        const key = publicacionKey(row, `${target.hint}:${cuenta.id}`);
        if (existingPubs.has(key)) {
          report.publicaciones.skipped_existing += 1;
          continue;
        }
        if (options.dryRun) {
          report.publicaciones.would_create += 1;
          counts.publicaciones_would_create += 1;
          existingPubs.add(key);
          continue;
        }
        const pubProps: Record<string, unknown> = {
          [propertyName('publicaciones', 'titulo')]: {
            title: [{ text: { content: `${title} · ${cuenta.nombre}`.slice(0, 2000) } }],
          },
          [propertyName('publicaciones', 'status')]: { status: { name: 'Pendiente' } },
          [propertyName('publicaciones', 'modo')]: { select: { name: 'dry-run' } },
          [propertyName('publicaciones', 'claveDeIdempotencia')]: {
            rich_text: [{ text: { content: key } }],
          },
          [propertyName('publicaciones', 'cuenta')]: { relation: [{ id: cuenta.id }] },
          ...(piezaId
            ? { [propertyName('publicaciones', 'pieza')]: { relation: [{ id: piezaId }] } }
            : {}),
        };
        applyOptionalPublicacionImageVersion(pubProps, {
          properties: row.properties,
          fields: row.fields,
        });
        await options.transport.createPage(options.ids.publicaciones, pubProps);
        existingPubs.add(key);
        report.publicaciones.created += 1;
      }
    }
  }

  return finalizeReport(report);
}
