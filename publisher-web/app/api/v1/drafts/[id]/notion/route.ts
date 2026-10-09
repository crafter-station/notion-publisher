import { notionWritePlan } from '../../../../../../lib/notion-write-plan';
import { writeNotionProperties } from '../../../../../../lib/server/notion-write';
import {
  ApiError,
  requireAdministrator,
  context,
  handle,
  respond,
} from '../../../../../../lib/server/context';
import {
  readInput,
  parseDraft,
  serializeDraft,
} from '../../../../../../lib/server/drafts';
import { readNotionPage } from '../../../../../../lib/server/notion';
import {
  notionContent,
  notionSnapshot,
  notionBaseline,
  mergeNotionContent,
  resolveNotionConflicts,
  type Content,
} from '../../../../../../lib/notion-content';
type Params = { params: Promise<{ id: string }> };
export const dynamic = 'force-dynamic';
async function comparison(request: Request, id: string, write = false) {
  const ctx = await context(request, write);
  const draft = await ctx.db
    .prepare('SELECT * FROM drafts WHERE workspace_id=? AND id=?')
    .bind(ctx.workspaceId, id)
    .first<Record<string, unknown>>();
  const link = await ctx.db
    .prepare('SELECT * FROM notion_links WHERE workspace_id=? AND draft_id=?')
    .bind(ctx.workspaceId, id)
    .first<{
      page_id: string;
      remote_snapshot: string;
      remote_edited_at: string;
    }>();
  if (!draft || !link)
    throw new ApiError(
      404,
      'notion_link_missing',
      'Este borrador no tiene un registro de Notion vinculado.',
    );
  const remote = await readNotionPage(link.page_id);
  const baseline = notionBaseline(link.remote_snapshot);
  const plan = mergeNotionContent(
    baseline,
    serializeDraft(draft) as Content,
    notionContent(remote.properties),
  );
  return { ctx, draft, link, remote, plan };
}
export async function GET(request: Request, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    const { ctx, draft, remote, plan } = await comparison(request, id);
    let outbound;
    try {
      outbound = {
        available: !plan.conflicts.length && !plan.changesDraft,
        ...notionWritePlan(remote.properties, serializeDraft(draft) as Content),
      };
    } catch (error) {
      outbound = { available: false, reason: (error as Error).message };
    }
    const attempts = await ctx.db
      .prepare(
        'SELECT id,revision,state,created_at FROM notion_writes WHERE workspace_id=? AND draft_id=? ORDER BY created_at DESC LIMIT 10',
      )
      .bind(ctx.workspaceId, id)
      .all();
    return respond({
      ...plan,
      outbound,
      attempts: attempts.results,
      revision: draft.revision,
      remoteEditedAt: remote.last_edited_time,
    });
  });
}
export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    // Check authorization before reading the body or contacting Notion.
    await context(request, true);
    const input = await readInput(request);
    if (!Number.isSafeInteger(input?.revision) || input.revision < 1)
      throw new ApiError(
        400,
        'revision_required',
        'Incluye la versión del borrador.',
      );
    const { id } = await params;
    const { ctx, draft, link, remote, plan } = await comparison(
      request,
      id,
      true,
    );
    if (input.revision !== draft.revision)
      throw new ApiError(
        409,
        'revision_conflict',
        'El borrador cambió. Vuelve a abrirlo antes de sincronizar.',
      );
    let resolved = plan;
    if (input.resolutions !== undefined) {
      if (
        typeof input.remoteEditedAt !== 'string' ||
        input.remoteEditedAt !== remote.last_edited_time
      )
        throw new ApiError(
          409,
          'notion_changed',
          'Notion cambió desde la comparación. Vuelve a comparar antes de resolver.',
        );
      try {
        resolved = resolveNotionConflicts(plan, input.resolutions);
      } catch (error) {
        throw new ApiError(
          400,
          'invalid_resolutions',
          (error as Error).message,
        );
      }
    }
    if (resolved.conflicts.length)
      return respond(
        {
          error: {
            code: 'notion_conflict',
            message:
              'Notion y el editor modificaron los mismos campos. Revisa las diferencias antes de sincronizar.',
          },
          conflicts: plan.conflicts,
        },
        409,
      );
    const content = parseDraft(resolved.content),
      now = new Date().toISOString();
    const results = await ctx.db.batch([
      ctx.db
        .prepare(
          "UPDATE drafts SET title=?,body=?,versions=?,channel_settings=COALESCE(?,channel_settings),revision=revision+1,updated_by=?,updated_at=?,status=CASE WHEN ? THEN 'draft' ELSE status END WHERE id=? AND workspace_id=? AND revision=?",
        )
        .bind(
          content.title,
          content.body,
          content.versions,
          content.channelSettings || '{}',
          ctx.userId,
          now,
          resolved.changesDraft ? 1 : 0,
          id,
          ctx.workspaceId,
          input.revision,
        ),
      // SQLite changes() refers to the preceding statement in this atomic batch.
      ctx.db
        .prepare(
          'UPDATE notion_links SET remote_snapshot=?,remote_edited_at=? WHERE workspace_id=? AND page_id=? AND changes()=1',
        )
        .bind(
          notionSnapshot(remote.properties),
          remote.last_edited_time,
          ctx.workspaceId,
          link.page_id,
        ),
    ]);
    if (!results[0].meta.changes)
      throw new ApiError(
        409,
        'revision_conflict',
        'El borrador cambió durante la comparación. Vuelve a intentarlo.',
      );
    return respond({
      id,
      revision: input.revision + 1,
      updated: resolved.changesDraft,
      notionWritten: false,
    });
  });
}

export async function PUT(request: Request, { params }: Params) {
  return handle(async () => {
    await context(request, true);
    const input = await readInput(request);
    if (
      !Number.isSafeInteger(input?.revision) ||
      input.revision < 1 ||
      typeof input.remoteEditedAt !== 'string'
    )
      throw new ApiError(
        400,
        'comparison_required',
        'Incluye la revisión y la fecha de Notion de la comparación.',
      );
    const { id } = await params;
    const { ctx, draft, link, remote, plan } = await comparison(
      request,
      id,
      true,
    );
    if (draft.revision !== input.revision)
      throw new ApiError(
        409,
        'revision_conflict',
        'El borrador cambió. Vuelve a comparar.',
      );
    if (remote.last_edited_time !== input.remoteEditedAt)
      throw new ApiError(
        409,
        'notion_changed',
        'Notion cambió. Vuelve a comparar.',
      );
    if (plan.conflicts.length || plan.changesDraft)
      throw new ApiError(
        409,
        'notion_pull_required',
        'Incorpora o resuelve los cambios de Notion antes de guardar allí.',
      );
    const desired = serializeDraft(draft) as Content;
    let outbound;
    try {
      outbound = notionWritePlan(remote.properties, desired);
    } catch (error) {
      throw new ApiError(
        422,
        'notion_unrepresentable',
        (error as Error).message,
      );
    }
    const active = await ctx.db
      .prepare(
        "SELECT id FROM notion_writes WHERE workspace_id=? AND page_id=? AND state IN ('writing','uncertain')",
      )
      .bind(ctx.workspaceId, link.page_id)
      .first();
    if (active)
      throw new ApiError(
        409,
        'notion_write_pending',
        'Hay una escritura en curso o sin confirmar. Revisa el intento anterior.',
      );
    if (!outbound.fields.length)
      return respond({ notionWritten: false, unchanged: true });
    const attemptId = crypto.randomUUID();
    const claim = await ctx.db
      .prepare(
        "INSERT INTO notion_writes (id,workspace_id,page_id,draft_id,revision,state,before_snapshot,desired_content,patch,created_by,created_at) SELECT ?,workspace_id,?,id,revision,'writing',?,?,?,?,? FROM drafts WHERE workspace_id=? AND id=? AND revision=? ON CONFLICT DO NOTHING",
      )
      .bind(
        attemptId,
        link.page_id,
        notionSnapshot(remote.properties),
        JSON.stringify(desired),
        JSON.stringify(outbound.properties),
        ctx.userId,
        new Date().toISOString(),
        ctx.workspaceId,
        id,
        input.revision,
      )
      .run();
    if (!claim.meta.changes)
      throw new ApiError(
        409,
        'notion_write_conflict',
        'Otro guardado comenzó o el borrador cambió.',
      );
    // Recheck after claiming. Notion has no compare-and-swap in this API;
    // this narrows, but cannot eliminate, races with edits made directly there.
    try {
      const fresh = await readNotionPage(link.page_id);
      if (fresh.last_edited_time !== remote.last_edited_time) {
        await ctx.db
          .prepare("UPDATE notion_writes SET state='cancelled' WHERE id=?")
          .bind(attemptId)
          .run();
        throw new ApiError(
          409,
          'notion_changed',
          'Notion cambió antes del envío. No se escribió.',
        );
      }
    } catch (error) {
      await ctx.db
        .prepare("UPDATE notion_writes SET state='cancelled' WHERE id=?")
        .bind(attemptId)
        .run();
      throw error;
    }
    try {
      await writeNotionProperties(link.page_id, outbound.properties);
      const receipt = await readNotionPage(link.page_id);
      if (notionWritePlan(receipt.properties, desired).fields.length)
        throw new Error('Readback differs from intended content');
      await ctx.db.batch([
        ctx.db
          .prepare(
            "UPDATE notion_writes SET state='confirmed',receipt=? WHERE id=? AND state='writing'",
          )
          .bind(notionSnapshot(receipt.properties), attemptId),
        ctx.db
          .prepare(
            'UPDATE notion_links SET remote_snapshot=?,remote_edited_at=? WHERE workspace_id=? AND page_id=? AND remote_edited_at=?',
          )
          .bind(
            notionSnapshot(receipt.properties),
            receipt.last_edited_time,
            ctx.workspaceId,
            link.page_id,
            link.remote_edited_at,
          ),
      ]);
      return respond({
        attemptId,
        notionWritten: true,
        revision: input.revision,
        remoteEditedAt: receipt.last_edited_time,
      });
    } catch (error) {
      await ctx.db
        .prepare(
          "UPDATE notion_writes SET state='uncertain',receipt=? WHERE id=? AND state='writing'",
        )
        .bind(
          JSON.stringify({
            failure:
              error instanceof ApiError
                ? error.code
                : 'write_or_readback_failed',
          }),
          attemptId,
        )
        .run();
      throw new ApiError(
        502,
        'notion_write_unconfirmed',
        'No se pudo confirmar el guardado. El intento quedó registrado y no se repetirá automáticamente.',
      );
    }
  });
}

// Reconciliation never sends a PATCH to Notion. It closes only the selected
// durable attempt after an administrator checks a fresh remote version.
export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await context(request, true);
    requireAdministrator(ctx.role);
    const input = await readInput(request);
    if (
      !input ||
      typeof input.attemptId !== 'string' ||
      typeof input.remoteEditedAt !== 'string' ||
      !['confirm', 'keep_notion'].includes(input.action)
    )
      throw new ApiError(
        400,
        'reconciliation_required',
        'Selecciona el intento, la versión de Notion y cómo cerrarlo.',
      );
    const { id } = await params;
    const attempt = await ctx.db
      .prepare(
        'SELECT * FROM notion_writes WHERE id=? AND workspace_id=? AND draft_id=?',
      )
      .bind(input.attemptId, ctx.workspaceId, id)
      .first<{
        id: string;
        page_id: string;
        state: string;
        created_at: string;
        desired_content: string;
      }>();
    if (!attempt)
      throw new ApiError(
        404,
        'notion_attempt_missing',
        'No se encontró el intento.',
      );
    if (!['writing', 'uncertain'].includes(attempt.state))
      throw new ApiError(
        409,
        'notion_attempt_closed',
        'El intento ya está cerrado. Vuelve a comparar.',
      );
    // Leave enough time for the bounded write/readback requests to settle.
    if (
      !Number.isFinite(Date.parse(attempt.created_at)) ||
      Date.now() - Date.parse(attempt.created_at) < 120000
    )
      throw new ApiError(
        409,
        'notion_attempt_running',
        'Espera dos minutos desde el envío antes de reconciliar.',
      );
    const remote = await readNotionPage(attempt.page_id);
    if (remote.last_edited_time !== input.remoteEditedAt)
      throw new ApiError(
        409,
        'notion_changed',
        'Notion cambió. Compara de nuevo antes de cerrar el intento.',
      );
    if (input.action === 'confirm') {
      let matches = false;
      try {
        matches =
          notionWritePlan(
            remote.properties,
            JSON.parse(attempt.desired_content),
          ).fields.length === 0;
      } catch {
        /* Nonrepresentable content cannot confirm a write. */
      }
      if (!matches)
        throw new ApiError(
          409,
          'notion_content_differs',
          'Notion no contiene el texto del intento. Revisa el registro antes de elegir conservar Notion.',
        );
    }
    const state = input.action === 'confirm' ? 'confirmed' : 'cancelled';
    const receipt = JSON.stringify({
      reconciliation: input.action,
      reconciledBy: ctx.userId,
      reconciledAt: new Date().toISOString(),
      remote: JSON.parse(notionSnapshot(remote.properties)),
    });
    const changed = await ctx.db
      .prepare(
        "UPDATE notion_writes SET state=?,receipt=? WHERE id=? AND workspace_id=? AND state IN ('writing','uncertain')",
      )
      .bind(state, receipt, attempt.id, ctx.workspaceId)
      .run();
    if (!changed.meta.changes)
      throw new ApiError(
        409,
        'notion_attempt_closed',
        'Otro administrador ya cerró el intento.',
      );
    // Keep local content and its baseline: the next compare/pull still exposes
    // remote differences rather than silently treating them as accepted edits.
    return respond({
      attemptId: attempt.id,
      state,
      notionWritten: false,
      message:
        'Intento cerrado. Compara de nuevo para revisar las diferencias antes de otro envío.',
    });
  });
}
