/**
 * Content OS graph reader: Pieza → ready Publicaciones → Cuenta → Canal.
 * Connectors consume the returned records (block 3 slot).
 */

import { propertyName, publicacionReadyStatuses } from '../config/content-os';
import { createPropertyReader, NotionPropertyReader } from './props';
import type { NotionPage, NotionTransport } from './notion-transport';

export type PiezaRecord = {
  id: string;
  nombre: string;
  status: string;
  captionBase: string;
  tipo: string;
  marca: string;
  idiomaBase: string;
  fecha: string;
  imageUrl: string;
  gifUrl: string;
  videoUrl: string;
  fileUrl: string;
  modulo: string;
  formato: string;
  ratio: string;
  tamanoPx: string;
  slides: number | null;
  codigoDePlantilla: string;
  templateOrigenFuturaria: string;
  statusDeDiseno: string;
  claveDeIdempotencia: string;
  canalIds: string[];
  productoIds: string[];
  publicacionIds: string[];
  reader: NotionPropertyReader;
};

export type PublicacionRecord = {
  id: string;
  titulo: string;
  status: string;
  modo: string;
  captionOverride: string;
  settings: string;
  idioma: string;
  programarPara: string;
  publicadoEl: string;
  urlPublicada: string;
  claveDeIdempotencia: string;
  idExterno: string;
  imageVersionUrl: string;
  piezaIds: string[];
  cuentaIds: string[];
  reader: NotionPropertyReader;
};

export type CuentaRecord = {
  id: string;
  nombre: string;
  estado: string;
  conector: string;
  handle: string;
  integrationId: string;
  marca: string;
  canalIds: string[];
};

export type CanalRecord = {
  id: string;
  nombre: string;
  conector: string;
  estadoDelConector: string;
  familia: string;
  settingsRequeridos: string;
};

export function parsePieza(page: NotionPage): PiezaRecord {
  const r = createPropertyReader(page.properties || {});
  return {
    id: page.id,
    nombre: r.title(propertyName('piezas', 'nombre')),
    status: r.status(propertyName('piezas', 'status')),
    captionBase: r.richText(propertyName('piezas', 'captionBase')),
    tipo: r.select(propertyName('piezas', 'tipo')),
    marca: r.select(propertyName('piezas', 'marca')),
    idiomaBase: r.select(propertyName('piezas', 'idiomaBase')),
    fecha: r.dateStart(propertyName('piezas', 'fechaDePublicacion')),
    imageUrl: r.fileUrl(propertyName('piezas', 'image')),
    gifUrl: r.fileUrl(propertyName('piezas', 'gif')),
    videoUrl: r.fileUrl(propertyName('piezas', 'video')),
    fileUrl: r.fileUrl(propertyName('piezas', 'file')),
    modulo: r.select(propertyName('piezas', 'modulo')),
    formato: r.select(propertyName('piezas', 'formato')),
    ratio: r.select(propertyName('piezas', 'ratio')),
    tamanoPx: r.richText(propertyName('piezas', 'tamanoPx')),
    slides: r.number(propertyName('piezas', 'slides')),
    codigoDePlantilla: r.richText(propertyName('piezas', 'codigoDePlantilla')),
    templateOrigenFuturaria: r.richText(propertyName('piezas', 'templateOrigenFuturaria')),
    statusDeDiseno: r.select(propertyName('piezas', 'statusDeDiseno')),
    claveDeIdempotencia: r.richText(propertyName('piezas', 'claveDeIdempotencia')),
    canalIds: r.relationIds(propertyName('piezas', 'canalesObjetivo')),
    productoIds: r.relationIds(propertyName('piezas', 'producto')),
    publicacionIds: r.relationIds(propertyName('piezas', 'publicaciones')),
    reader: r,
  };
}

export function parsePublicacion(page: NotionPage): PublicacionRecord {
  const r = createPropertyReader(page.properties || {});
  return {
    id: page.id,
    titulo: r.title(propertyName('publicaciones', 'titulo')),
    status: r.status(propertyName('publicaciones', 'status')),
    modo: r.select(propertyName('publicaciones', 'modo')),
    captionOverride: r.richText(propertyName('publicaciones', 'captionOverride')),
    settings: r.richText(propertyName('publicaciones', 'settings')),
    idioma: r.select(propertyName('publicaciones', 'idioma')),
    programarPara: r.dateStart(propertyName('publicaciones', 'programarPara')),
    publicadoEl: r.dateStart(propertyName('publicaciones', 'publicadoEl')),
    urlPublicada: r.url(propertyName('publicaciones', 'urlPublicada')),
    claveDeIdempotencia: r.richText(propertyName('publicaciones', 'claveDeIdempotencia')),
    idExterno: r.richText(propertyName('publicaciones', 'idExterno')),
    imageVersionUrl: r.fileUrl(propertyName('publicaciones', 'imageVersion')),
    piezaIds: r.relationIds(propertyName('publicaciones', 'pieza')),
    cuentaIds: r.relationIds(propertyName('publicaciones', 'cuenta')),
    reader: r,
  };
}

export function parseCuenta(page: NotionPage): CuentaRecord {
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

export function parseCanal(page: NotionPage): CanalRecord {
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

export function isReadyPublicacion(pub: PublicacionRecord): boolean {
  return publicacionReadyStatuses().includes(pub.status);
}

export class ContentOsReader {
  constructor(
    private transport: NotionTransport,
    private ids: { piezas: string; publicaciones: string; cuentas: string; canales: string }
  ) {}

  async getPieza(piezaId: string): Promise<PiezaRecord> {
    return parsePieza(await this.transport.getPage(piezaId));
  }

  async getPublicacion(id: string): Promise<PublicacionRecord> {
    return parsePublicacion(await this.transport.getPage(id));
  }

  async getCuenta(id: string): Promise<CuentaRecord> {
    return parseCuenta(await this.transport.getPage(id));
  }

  async getCanal(id: string): Promise<CanalRecord> {
    return parseCanal(await this.transport.getPage(id));
  }

  async listReadyPublicaciones(piezaId: string): Promise<PublicacionRecord[]> {
    const filter = {
      and: [
        { property: propertyName('publicaciones', 'pieza'), relation: { contains: piezaId } },
        {
          or: publicacionReadyStatuses().map(status => ({
            property: propertyName('publicaciones', 'status'),
            status: { equals: status },
          })),
        },
      ],
    };
    const pages = await this.transport.queryAll(this.ids.publicaciones, filter);
    return pages.map(parsePublicacion).filter(isReadyPublicacion);
  }

  async findByIdempotencyKey(key: string): Promise<PublicacionRecord | null> {
    if (!key) return null;
    const pages = await this.transport.queryAll(this.ids.publicaciones, {
      property: propertyName('publicaciones', 'claveDeIdempotencia'),
      rich_text: { equals: key },
    });
    return pages[0] ? parsePublicacion(pages[0]) : null;
  }
}

/** Merge Pieza + Publicacion into a properties bag connectors can read. */
export function mergedPublishProperties(
  pieza: PiezaRecord,
  pub: PublicacionRecord
): Record<string, any> {
  const caption = pub.captionOverride || pieza.captionBase;
  const imageUrl = pub.imageVersionUrl || pieza.imageUrl;
  return {
    Name: { title: [{ plain_text: pub.titulo || pieza.nombre }] },
    Caption: { rich_text: [{ plain_text: caption }] },
    'POV Text': { rich_text: [{ plain_text: caption }] },
    Image: imageUrl
      ? { files: [{ type: 'external', external: { url: imageUrl } }] }
      : { files: [] },
    GIF: pieza.gifUrl ? { files: [{ type: 'external', external: { url: pieza.gifUrl } }] } : { files: [] },
    Video: pieza.videoUrl
      ? { files: [{ type: 'external', external: { url: pieza.videoUrl } }] }
      : { files: [] },
    File: pieza.fileUrl ? { files: [{ type: 'external', external: { url: pieza.fileUrl } }] } : { files: [] },
    Schedule: pub.programarPara ? { date: { start: pub.programarPara } } : {},
    Settings: { rich_text: [{ plain_text: pub.settings }] },
    ...parseSettingsObject(pub.settings),
  };
}

function parseSettingsObject(raw: string): Record<string, any> {
  const t = raw.trim();
  if (!t.startsWith('{')) return {};
  try {
    const obj = JSON.parse(t) as Record<string, any>;
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') out[k] = { rich_text: [{ plain_text: v }] };
    }
    return out;
  } catch {
    return {};
  }
}
