/**
 * Map legacy Publisher rows (or a snapshot JSON) to 🧩 Piezas + 🚀 Publicaciones.
 * --dry-run is the default. Idempotent via Clave de idempotencia.
 *
 * Piezas have no dedicated idempotency property in the live schema.
 * Skip uses `publisher:<page_id>` derived from Publicaciones keys
 * (`publisher:<page_id>:<hint>:<cuentaId>`). See README for the proposed
 * Piezas `Clave de idempotencia` addition.
 */

import { CatalogCanal, CatalogCuenta, ChannelAccountCatalog } from '../catalog/channels';
import { listDeclaredPropertyNames } from '../config/schema';
import { propertyName } from '../config/content-os';
import { parsePublicacion } from '../readers/content-os.reader';
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

export type MigrationReport = {
  dry_run: boolean;
  status: 'ok' | 'error';
  source_rows: number;
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
  warnings: string[];
  errors: string[];
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

function emptyReport(dryRun: boolean, sourceRows: number): MigrationReport {
  return {
    dry_run: dryRun,
    status: 'ok',
    source_rows: sourceRows,
    piezas: { would_create: 0, skipped_existing: 0, created: 0 },
    publicaciones: { would_create: 0, skipped_existing: 0, created: 0, expected: 0 },
    layers: {},
    missing_cuentas: [],
    unmatched_channels: [],
    unknown_columns: [],
    warnings: [],
    errors: [],
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

function asStringList(value: unknown): string[] {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) {
    return value.flatMap(v => asStringList(v));
  }
  if (typeof value === 'object') {
    const o = value as any;
    if (o.name) return [String(o.name)];
    if (Array.isArray(o.multi_select)) return o.multi_select.map((x: any) => String(x?.name || '')).filter(Boolean);
  }
  return String(value)
    .split(/[,;]/)
    .map(s => s.trim())
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

export function listSnapshotUnknownColumns(raw: unknown): string[] {
  const rows = extractRawRows(raw);
  const known = knownFlatKeySet();
  const unknown = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    if (row.properties && typeof row.properties === 'object') continue;
    for (const key of Object.keys(row)) {
      const norm = key.trim().toLowerCase();
      if (!known.has(norm)) unknown.add(key.trim());
    }
  }
  return [...unknown].sort((a, b) => a.localeCompare(b));
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
      channels: row.channels,
      layer: row.layer,
    };
  }
  const flat = lowerKeyMap(row);
  const id = String(flat.page_id || flat['page id'] || flat.id || flat.notion_page_id || flat['notion page id'] || '');
  const title = firstText(flat.name, flat.title);
  const caption = firstText(flat.caption);
  const layer = firstText(flat.layer);
  const channels = asStringList(flat.channels);
  const sources = asStringList(flat['source tags'] ?? flat.sources ?? flat.source);
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
  };
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
  return [...fromRow, ...fromProps].map(s => String(s).trim()).filter(Boolean);
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
      pushUnique(unmatched, name);
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
  offline?: boolean;
  unknownColumns?: string[];
}): Promise<MigrationReport> {
  const report = emptyReport(options.dryRun, options.rows.length);
  report.unknown_columns = [...(options.unknownColumns || [])];

  const existing = new Set(options.existingKeys || []);
  for (const key of [...existing]) {
    const m = key.match(/^(publisher:[^:]+)/);
    if (m) existing.add(m[1]);
  }

  if (!activaCuentas(options.catalog).length) {
    report.status = 'error';
    report.errors.push(
      'Cuentas catalog is empty (or has no Activa rows). Refusing to create Piezas without a Cuenta to attach Publicaciones.'
    );
    return report;
  }

  if (options.offline === false && catalogHasStaticIds(options.catalog)) {
    report.status = 'error';
    report.errors.push(
      'static-* Canal/Cuenta ids are only valid in --offline mode. A live run needs real Notion Cuentas.'
    );
    return report;
  }

  for (const row of options.rows) {
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
    if (existing.has(pKey)) {
      report.piezas.skipped_existing += 1;
    } else if (options.dryRun) {
      report.piezas.would_create += 1;
      counts.piezas_would_create += 1;
      existing.add(pKey);
    } else {
      const piezaProps: Record<string, unknown> = {
        [propertyName('piezas', 'nombre')]: { title: [{ text: { content: title.slice(0, 2000) } }] },
        [propertyName('piezas', 'status')]: { status: { name: 'Lista' } },
        [propertyName('piezas', 'captionBase')]: {
          rich_text: [{ text: { content: (firstText(row.fields?.Caption) || title).slice(0, 2000) } }],
        },
      };
      applyOptionalPiezaDesignFields(piezaProps, { properties: row.properties, fields: row.fields });
      const created = await options.transport.createPage(options.ids.piezas, piezaProps);
      piezaId = created.id;
      existing.add(pKey);
      report.piezas.created += 1;
    }

    for (const { target, cuentas } of resolved) {
      for (const cuenta of cuentas) {
        const key = publicacionKey(row, `${target.hint}:${cuenta.id}`);
        if (existing.has(key)) {
          report.publicaciones.skipped_existing += 1;
          continue;
        }
        if (options.dryRun) {
          report.publicaciones.would_create += 1;
          counts.publicaciones_would_create += 1;
          existing.add(key);
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
        existing.add(key);
        report.publicaciones.created += 1;
      }
    }
  }

  return report;
}
