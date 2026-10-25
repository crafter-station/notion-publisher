/**
 * to-cms → one 🧩 Pieza + one 🚀 Publicacion per target 🪪 Cuenta.
 * Never publishes. Dry-run is the default at the CLI.
 */

import { propertyName } from '../config/content-os';
import { CatalogCuenta } from '../catalog/channels';
import { applyOptionalPiezaDesignFields, applyOptionalPublicacionImageVersion } from './content-os-fields';
import { ResolvedIngest } from './to-cms-ingest';

export type ContentOsIngestPlan = {
  pieza: { properties: Record<string, unknown> };
  publicaciones: Array<{ cuentaId: string; properties: Record<string, unknown> }>;
};

function title(content: string) {
  return { title: [{ text: { content: (content || 'Untitled').slice(0, 2000) } }] };
}
function rt(content: string) {
  return { rich_text: [{ text: { content: content.slice(0, 2000) } }] };
}
function select(name: string) {
  return { select: { name } };
}
function status(name: string) {
  return { status: { name } };
}
function relation(ids: string[]) {
  return { relation: ids.filter(Boolean).map(id => ({ id })) };
}

function tipoFromLayers(layers: string[]): string {
  if (layers.includes('Events')) return 'Evento';
  if (layers.includes('Products')) return 'Producto';
  if (layers.includes('Music')) return 'Música';
  return 'Social';
}

export function buildContentOsIngest(
  resolved: ResolvedIngest,
  cuentas: CatalogCuenta[],
  options: { canalIds?: string[]; marca?: string } = {}
): ContentOsIngestPlan {
  const caption =
    resolved.pages[0]?.fields?.Caption ||
    resolved.pages[0]?.fields?.['POV Text'] ||
    resolved.title;
  const piezaProps: Record<string, unknown> = {
    [propertyName('piezas', 'nombre')]: title(resolved.title),
    [propertyName('piezas', 'status')]: status('Lista'),
    [propertyName('piezas', 'captionBase')]: rt(caption || resolved.title),
    [propertyName('piezas', 'tipo')]: select(tipoFromLayers(resolved.layers)),
    [propertyName('piezas', 'marca')]: select(options.marca || 'nebulabs'),
  };
  if (options.canalIds?.length) {
    piezaProps[propertyName('piezas', 'canalesObjetivo')] = relation(options.canalIds);
  }
  applyOptionalPiezaDesignFields(piezaProps, { fields: resolved.pages[0]?.fields });

  const publicaciones = cuentas.map(cuenta => {
    const key = `tocms:${slug(resolved.title)}:${cuenta.id}`;
    const properties: Record<string, unknown> = {
      [propertyName('publicaciones', 'titulo')]: title(`${resolved.title} · ${cuenta.nombre}`),
      [propertyName('publicaciones', 'status')]: status('Pendiente'),
      [propertyName('publicaciones', 'modo')]: select('dry-run'),
      [propertyName('publicaciones', 'claveDeIdempotencia')]: rt(key),
      [propertyName('publicaciones', 'cuenta')]: relation([cuenta.id]),
      [propertyName('publicaciones', 'captionOverride')]: rt(caption || ''),
    };
    applyOptionalPublicacionImageVersion(properties, { fields: resolved.pages[0]?.fields });
    return { cuentaId: cuenta.id, properties };
  });

  return { pieza: { properties: piezaProps }, publicaciones };
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export async function createContentOsIngest(
  transport: import('../readers/notion-transport').NotionTransport,
  ids: { piezas: string; publicaciones: string },
  plan: ContentOsIngestPlan
): Promise<{ piezaId: string; publicacionIds: string[] }> {
  const pieza = await transport.createPage(ids.piezas, plan.pieza.properties);
  const publicacionIds: string[] = [];
  for (const pub of plan.publicaciones) {
    const created = await transport.createPage(ids.publicaciones, {
      ...pub.properties,
      [propertyName('publicaciones', 'pieza')]: { relation: [{ id: pieza.id }] },
    });
    publicacionIds.push(created.id);
  }
  return { piezaId: pieza.id, publicacionIds };
}
