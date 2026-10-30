/**
 * Generic Notion property reader. Connectors and Content OS code use this
 * instead of ad-hoc extract* helpers. Driven by schema property names.
 */

export type NotionProps = Record<string, any>;

export function readRichText(props: NotionProps, name: string): string {
  const p = props?.[name];
  if (p?.rich_text?.length) return p.rich_text.map((t: any) => t.plain_text).join('').trim();
  return '';
}

export function readTitle(props: NotionProps, name: string): string {
  const p = props?.[name];
  if (p?.title?.length) return p.title.map((t: any) => t.plain_text).join('').trim();
  return readRichText(props, name);
}

export function readSelect(props: NotionProps, name: string): string {
  return String(props?.[name]?.select?.name || '').trim();
}

export function readStatus(props: NotionProps, name: string): string {
  return String(props?.[name]?.status?.name || '').trim();
}

export function readMultiSelect(props: NotionProps, name: string): string[] {
  return (props?.[name]?.multi_select || [])
    .map((x: any) => String(x?.name || '').trim())
    .filter(Boolean);
}

export function readUrl(props: NotionProps, name: string): string {
  const u = props?.[name]?.url;
  return typeof u === 'string' ? u.trim() : '';
}

export function readDateStart(props: NotionProps, name: string): string {
  return String(props?.[name]?.date?.start || '').trim();
}

export function readDateEnd(props: NotionProps, name: string): string {
  return String(props?.[name]?.date?.end || '').trim();
}

export function readCheckbox(props: NotionProps, name: string): boolean {
  return props?.[name]?.checkbox === true;
}

export function readNumber(props: NotionProps, name: string): number | null {
  const n = props?.[name]?.number;
  return typeof n === 'number' ? n : null;
}

export type NotionFileRef = {
  url: string;
  name: string;
};

function fileRefFromNotion(file: any): NotionFileRef | null {
  const name = String(file?.name || '').trim();
  if (file?.type === 'external') {
    const url = String(file.external?.url || '').trim();
    return url ? { url, name: name || url } : null;
  }
  if (file?.type === 'file') {
    const url = String(file.file?.url || '').trim();
    return url ? { url, name: name || url } : null;
  }
  return null;
}

export function readFileUrl(props: NotionProps, name: string): string {
  return readFiles(props, name)[0]?.url || '';
}

/** Every file on a Notion files property, in the stored array order. */
export function readFiles(props: NotionProps, name: string): NotionFileRef[] {
  const files = props?.[name]?.files;
  if (!Array.isArray(files) || files.length === 0) return [];
  const out: NotionFileRef[] = [];
  for (const file of files) {
    const ref = fileRefFromNotion(file);
    if (ref) out.push(ref);
  }
  return out;
}

export function readRelationIds(props: NotionProps, name: string): string[] {
  return (props?.[name]?.relation || [])
    .map((r: any) => String(r?.id || '').trim())
    .filter(Boolean);
}

export type NotionPropertyReader = {
  richText(name: string): string;
  title(name: string): string;
  select(name: string): string;
  status(name: string): string;
  multiSelect(name: string): string[];
  url(name: string): string;
  dateStart(name: string): string;
  dateEnd(name: string): string;
  checkbox(name: string): boolean;
  number(name: string): number | null;
  fileUrl(name: string): string;
  files(name: string): NotionFileRef[];
  relationIds(name: string): string[];
  raw(): NotionProps;
};

export function createPropertyReader(props: NotionProps = {}): NotionPropertyReader {
  return {
    richText: name => readRichText(props, name),
    title: name => readTitle(props, name),
    select: name => readSelect(props, name),
    status: name => readStatus(props, name),
    multiSelect: name => readMultiSelect(props, name),
    url: name => readUrl(props, name),
    dateStart: name => readDateStart(props, name),
    dateEnd: name => readDateEnd(props, name),
    checkbox: name => readCheckbox(props, name),
    number: name => readNumber(props, name),
    fileUrl: name => readFileUrl(props, name),
    files: name => readFiles(props, name),
    relationIds: name => readRelationIds(props, name),
    raw: () => props,
  };
}
