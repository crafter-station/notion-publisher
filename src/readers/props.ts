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

export function readFileUrl(props: NotionProps, name: string): string {
  const files = props?.[name]?.files;
  if (!files?.length) return '';
  const f = files[0];
  if (f?.type === 'external') return String(f.external?.url || '').trim();
  if (f?.type === 'file') return String(f.file?.url || '').trim();
  return '';
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
    relationIds: name => readRelationIds(props, name),
    raw: () => props,
  };
}
