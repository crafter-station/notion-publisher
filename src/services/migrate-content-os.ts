/**
 * Map legacy Publisher rows (or a snapshot JSON) to 🧩 Piezas + 🚀 Publicaciones.
 * --dry-run is the default. Idempotent via Clave de idempotencia.
 */

import { CatalogCuenta, ChannelAccountCatalog } from '../catalog/channels';
import { propertyName } from '../config/content-os';
import { parsePublicacion } from '../readers/content-os.reader';
import { createPropertyReader } from '../readers/props';
import { NotionTransport } from '../readers/notion-transport';
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

export type MigrationReport = {
  dry_run: boolean;
  source_rows: number;
  piezas: { would_create: number; skipped_existing: number; created: number };
  publicaciones: { would_create: number; skipped_existing: number; created: number };
  missing_cuentas: string[];
  errors: string[];
};

export function loadPublisherSnapshot(raw: unknown): LegacyPublisherRow[] {
  if (Array.isArray(raw)) return raw.map(normalizeRow);
  if (raw && typeof raw === 'object') {
    const o = raw as any;
    if (Array.isArray(o.pages)) return o.pages.map(normalizeRow);
    if (Array.isArray(o.results)) return o.results.map(normalizeRow);
    if (Array.isArray(o.rows)) return o.rows.map(normalizeRow);
  }
  throw new Error('Snapshot must be an array or { pages|results|rows: [] }');
}

function normalizeRow(row: any): LegacyPublisherRow {
  if (!row || typeof row !== 'object') throw new Error('Invalid snapshot row');
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

function inferConnectors(row: LegacyPublisherRow): string[] {
  const r = createPropertyReader(row.properties || {});
  const tags = row.sources || r.multiSelect('Source Tags');
  const channels = row.channels || r.multiSelect('Channels') || r.multiSelect('Postiz Targets');
  const layer = row.layer || r.select('Layer');
  const found = new Set<string>();
  const blob = [...tags, ...channels, layer].join(' ').toLowerCase();
  if (tags.includes('Postly') || layer === 'Social') found.add('Postly');
  if (tags.includes('Gumroad') || layer === 'Products') found.add('Nativo:Productos');
  if (tags.includes('GitHub')) found.add('Nativo:Código');
  if (tags.includes('Luma')) found.add('Nativo:Eventos');
  if (channels.includes('Reddit') || tags.includes('Composio')) found.add('Composio:Social');
  if (channels.includes('Eventbrite')) found.add('Composio:Eventos');
  if (r.richText('Restream Title') || /restream/.test(blob)) found.add('Nativo:Live');
  if (r.richText('Typefully Account') || r.richText('Typefully Thread')) found.add('Typefully');
  if (r.multiSelect('Postiz Targets').length) found.add('Postiz');
  if (!found.size) found.add('Postly');
  return [...found];
}

function rowTitle(row: LegacyPublisherRow): string {
  const r = createPropertyReader(row.properties || {});
  return (
    row.title ||
    r.title('Name') ||
    r.richText('Caption') ||
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

function matchCuentas(catalog: ChannelAccountCatalog, hint: string): CatalogCuenta[] {
  const [conector, familia] = hint.split(':');
  return catalog.cuentas.filter(c => {
    if (c.estado !== 'Activa') return false;
    if (c.conector === hint) return true;
    if (c.conector === conector) {
      if (!familia) return true;
      const canal = catalog.canales.find(ch => c.canalIds.includes(ch.id));
      return !canal || canal.familia === familia || canal.conector === conector;
    }
    return false;
  });
}

export async function migrateContentOs(options: {
  rows: LegacyPublisherRow[];
  catalog: ChannelAccountCatalog;
  transport: NotionTransport;
  ids: { piezas: string; publicaciones: string };
  dryRun: boolean;
  existingKeys?: Set<string>;
}): Promise<MigrationReport> {
  const report: MigrationReport = {
    dry_run: options.dryRun,
    source_rows: options.rows.length,
    piezas: { would_create: 0, skipped_existing: 0, created: 0 },
    publicaciones: { would_create: 0, skipped_existing: 0, created: 0 },
    missing_cuentas: [],
    errors: [],
  };

  const existing = new Set(options.existingKeys || []);
  for (const key of [...existing]) {
    const m = key.match(/^(publisher:[^:]+)/);
    if (m) existing.add(m[1]);
  }

  for (const row of options.rows) {
    if (!row.id) {
      report.errors.push('row missing id');
      continue;
    }
    const title = rowTitle(row);
    const hints = inferConnectors(row);
    const pKey = piezaKey(row);

    let piezaId: string | undefined;
    if (existing.has(pKey)) {
      report.piezas.skipped_existing += 1;
    } else if (options.dryRun) {
      report.piezas.would_create += 1;
      existing.add(pKey);
    } else {
      const piezaProps: Record<string, unknown> = {
        [propertyName('piezas', 'nombre')]: { title: [{ text: { content: title.slice(0, 2000) } }] },
        [propertyName('piezas', 'status')]: { status: { name: 'Lista' } },
        [propertyName('piezas', 'captionBase')]: {
          rich_text: [{ text: { content: title.slice(0, 2000) } }],
        },
      };
      applyOptionalPiezaDesignFields(piezaProps, { properties: row.properties, fields: row.fields });
      const created = await options.transport.createPage(options.ids.piezas, piezaProps);
      piezaId = created.id;
      existing.add(pKey);
      report.piezas.created += 1;
    }

    for (const hint of hints) {
      const cuentas = matchCuentas(options.catalog, hint);
      if (!cuentas.length) {
        if (!report.missing_cuentas.includes(hint)) report.missing_cuentas.push(hint);
        continue;
      }
      for (const cuenta of cuentas) {
        const key = publicacionKey(row, `${hint}:${cuenta.id}`);
        if (existing.has(key)) {
          report.publicaciones.skipped_existing += 1;
          continue;
        }
        if (options.dryRun) {
          report.publicaciones.would_create += 1;
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
