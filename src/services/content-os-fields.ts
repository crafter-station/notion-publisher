/**
 * Optional Piezas design fields + Publicaciones Image (versión).
 * Never required. Used by to-cms and migrate when the input has them.
 */

import { propertyName } from '../config/content-os';
import { PIEZA_OPTIONAL_DESIGN_KEYS, SCHEMA_BASES } from '../config/schema';
import { createPropertyReader } from '../readers/props';

function rt(content: string) {
  return { rich_text: [{ text: { content: String(content).slice(0, 2000) } }] };
}

function lookupField(
  fields: Record<string, string | number | undefined> | undefined,
  names: string[]
): string | number | undefined {
  if (!fields) return undefined;
  for (const name of names) {
    const v = fields[name];
    if (v !== undefined && v !== '') return v;
  }
  return undefined;
}

/** Copy optional design props onto a Pieza create payload when present. */
export function applyOptionalPiezaDesignFields(
  target: Record<string, unknown>,
  input: {
    fields?: Record<string, string | number | undefined>;
    properties?: Record<string, any>;
  } = {}
): void {
  const r = createPropertyReader(input.properties || {});
  for (const key of PIEZA_OPTIONAL_DESIGN_KEYS) {
    const prop = SCHEMA_BASES.piezas.properties[key];
    const name = propertyName('piezas', key);
    let value: string | number | undefined = lookupField(input.fields, [name, key]);
    if ((value === undefined || value === '') && input.properties) {
      if (prop.type === 'select') value = r.select(name) || undefined;
      else if (prop.type === 'number') value = r.number(name) ?? undefined;
      else value = r.richText(name) || undefined;
    }
    if (value === undefined || value === '') continue;
    if (prop.type === 'select') target[name] = { select: { name: String(value) } };
    else if (prop.type === 'number') {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isNaN(n)) target[name] = { number: n };
    } else {
      target[name] = rt(String(value));
    }
  }
}

/** Optional per-Publicacion Image (versión) file URL. */
export function applyOptionalPublicacionImageVersion(
  target: Record<string, unknown>,
  input: {
    fields?: Record<string, string | number | undefined>;
    properties?: Record<string, any>;
  } = {}
): void {
  const name = propertyName('publicaciones', 'imageVersion');
  const fromFields = lookupField(input.fields, [name, 'imageVersion', 'Image (version)']);
  const fromProps = createPropertyReader(input.properties || {}).fileUrl(name);
  const url = (typeof fromFields === 'string' && fromFields) || fromProps;
  if (!url) return;
  target[name] = { files: [{ type: 'external', external: { url } }] };
}
