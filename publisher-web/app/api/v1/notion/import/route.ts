import {
  context,
  handle,
  respond,
  ApiError,
} from '../../../../../lib/server/context';
import { readInput, parseDraft } from '../../../../../lib/server/drafts';
import {
  notionContent,
  notionSnapshot,
} from '../../../../../lib/notion-content';
import { readNotionPage } from '../../../../../lib/server/notion';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  return handle(async () => {
    const ctx = await context(request, true);
    const input = await readInput(request);
    if (
      typeof input?.pageId !== 'string' ||
      !/^(?:[a-f0-9]{32}|[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})$/i.test(
        input.pageId,
      )
    )
      throw new ApiError(
        400,
        'invalid_page',
        'Selecciona un registro válido de Notion.',
      );
    const pageId = input.pageId.replaceAll('-', '').toLowerCase();
    const existing = await ctx.db
      .prepare(
        'SELECT draft_id FROM notion_links WHERE workspace_id=? AND page_id=?',
      )
      .bind(ctx.workspaceId, pageId)
      .first<{ draft_id: string }>();
    if (existing) return respond({ id: existing.draft_id, imported: false });
    let row;
    try {
      row = await readNotionPage(pageId);
    } catch (error) {
      const concurrent = await ctx.db
        .prepare(
          'SELECT draft_id FROM notion_links WHERE workspace_id=? AND page_id=?',
        )
        .bind(ctx.workspaceId, pageId)
        .first<{ draft_id: string }>();
      if (concurrent)
        return respond({ id: concurrent.draft_id, imported: false });
      throw error;
    }
    const content = parseDraft(notionContent(row.properties));
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(ctx.workspaceId + ':' + pageId),
    );
    const id =
      'notion-' +
      Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, '0'),
      ).join('');
    const now = new Date().toISOString();
    // A transaction and deterministic ID make concurrent imports idempotent.
    // Never update an existing draft: it may contain newer team edits.
    await ctx.db.batch([
      ctx.db
        .prepare(
          'INSERT INTO drafts (id,workspace_id,title,body,versions,channel_settings,status,revision,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,1,?,?,?,?) ON CONFLICT(id) DO NOTHING',
        )
        .bind(
          id,
          ctx.workspaceId,
          content.title,
          content.body,
          content.versions,
          content.channelSettings || '{}',
          'draft',
          ctx.userId,
          ctx.userId,
          now,
          now,
        ),
      ctx.db
        .prepare(
          'INSERT INTO notion_links (workspace_id,page_id,draft_id,notion_url,remote_edited_at,remote_snapshot,imported_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(workspace_id,page_id) DO NOTHING',
        )
        .bind(
          ctx.workspaceId,
          pageId,
          id,
          row.url,
          row.last_edited_time,
          notionSnapshot(row.properties),
          now,
        ),
    ]);
    return respond({ id, imported: true }, 201);
  });
}
