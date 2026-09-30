import { mkdir, open, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildTypefullyDraft } from '../services/typefully-notion.service';

type Draft = ReturnType<typeof buildTypefullyDraft>;
type Receipt = { id: number; private_url: string; status: 'draft' };
type Journal = { state: 'creating' } | { state: 'created' | 'synced'; receipt: Receipt };
type Page = { id: string; archived?: boolean; in_trash?: boolean; parent?: { database_id?: string }; properties: Parameters<typeof buildTypefullyDraft>[0] };
type Dependencies = {
  databaseId: string;
  journalDirectory: string;
  getPage: (id: string) => Promise<Page>;
  createDraft: (draft: Draft) => Promise<unknown>;
  updatePage: (id: string, properties: Record<string, unknown>) => Promise<unknown>;
};
const canonicalId = (id: string) => {
  if (!/^(?:[a-f\d]{32}|[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12})$/i.test(id)) throw new Error('Invalid Notion page/database ID');
  return id.replace(/-/g, '').toLowerCase();
};
function receiptFrom(value: unknown): Receipt {
  const result = value as { successful?: boolean; data?: unknown };
  if (result?.successful !== true) throw new Error('Typefully did not confirm creation; reconcile the operation before retrying.');
  const data = result.data as Receipt;
  if (!Number.isSafeInteger(data?.id) || data.id <= 0 || data.status !== 'draft') throw new Error('Unexpected Typefully draft response; reconcile before retrying.');
  let url: URL;
  try { url = new URL(data.private_url); } catch { throw new Error('Typefully did not return a valid private draft URL.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'typefully.com' || url.username || url.password) throw new Error('Unexpected Typefully draft URL.');
  return { id: data.id, private_url: url.href, status: 'draft' };
}

/** Single persistent host: exclusive reservation prevents duplicate creates, including after crashes.
 * A creating record is deliberately never retried automatically. Reconcile with Typefully first.
 * Cloud replicas need a shared transactional job store before using this workflow.
 */
export async function createTypefullyDraftFromNotion(pageId: string, deps: Dependencies) {
  const id = canonicalId(pageId);
  const databaseId = canonicalId(deps.databaseId);
  const page = await deps.getPage(id);
  if (canonicalId(page.id) !== id || canonicalId(page.parent?.database_id || '') !== databaseId) throw new Error('Page is outside the configured Publisher database');
  if (page.archived || page.in_trash) throw new Error('Cannot process an archived Notion page');
  await mkdir(deps.journalDirectory, { recursive: true, mode: 0o700 });
  const path = join(deps.journalDirectory, databaseId + '-' + id + '.json');
  let journal: Journal | undefined;
  try { journal = JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  if (!journal) {
    if (!page.properties['Source Tags']?.multi_select?.some(source => source.name === 'Typefully')) throw new Error('Source Tags must include Typefully');
    const draft = buildTypefullyDraft(page.properties);
    // Persist before calling the external service. EEXIST also protects concurrent callers.
    const reservation = await open(path, 'wx', 0o600);
    try { await reservation.writeFile(JSON.stringify({ state: 'creating' })); await reservation.sync(); }
    finally { await reservation.close(); }
    const receipt = receiptFrom(await deps.createDraft(draft));
    journal = { state: 'created', receipt };
    await persist(path, journal);
  }
  if (journal.state === 'creating') throw new Error('Creation is pending or uncertain. Reconcile with Typefully before any new attempt.');
  if (!['created', 'synced'].includes(journal.state)) throw new Error('Invalid draft journal');
  const receipt = receiptFrom({ successful: true, data: journal.receipt });
  const currentUrl = page.properties['Typefully URL']?.url;
  if (currentUrl && currentUrl !== receipt.private_url) throw new Error('Notion links to a different draft; refusing to overwrite it.');
  if (journal.state === 'synced') return { ...receipt, reused: true };
  await deps.updatePage(id, {
    'Typefully URL': { url: receipt.private_url },
    'Typefully Publish Status': { status: { name: 'In progress' } },
  });
  await persist(path, { state: 'synced', receipt });
  return { ...receipt, reused: false };
}
async function persist(path: string, journal: Journal) {
  const temporary = path + '.' + process.pid + '.' + randomUUID() + '.tmp';
  await writeFile(temporary, JSON.stringify(journal), { mode: 0o600 });
  const file = await open(temporary, 'r');
  try { await file.sync(); } finally { await file.close(); }
  await rename(temporary, path);
}
