import {
  ApiError,
  context,
  handle,
  respond,
} from '../../../../../../lib/server/context';
import { readInput, serializeDraft } from '../../../../../../lib/server/drafts';
import {
  typefullyConnections,
  createPrivateTypefullyDraft,
} from '../../../../../../lib/server/typefully-connections';
import {
  typefullyPayload,
  typefullyReceipt,
} from '../../../../../../lib/typefully-payload';
import type { Content } from '../../../../../../lib/notion-content';
import { readNotionPage } from '../../../../../../lib/server/notion';
export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await context(request),
      { id } = await params;
    const rows = await ctx.db
      .prepare(
        'SELECT social_set_id,revision,state,receipt,created_at FROM typefully_drafts WHERE workspace_id=? AND draft_id=?',
      )
      .bind(ctx.workspaceId, id)
      .all<{
        social_set_id: number;
        revision: number;
        state: string;
        receipt: string | null;
        created_at: string;
      }>();
    return respond({
      items: rows.results.map((row) => ({
        ...row,
        receipt: row.receipt ? JSON.parse(row.receipt) : null,
      })),
    });
  });
}
export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await context(request, true),
      { id } = await params,
      input = await readInput(request);
    if (!input || !Number.isSafeInteger(input.revision) || input.revision < 1)
      throw new ApiError(
        400,
        'revision_required',
        'Incluye la versión actual del borrador.',
      );
    const draft = await ctx.db
      .prepare('SELECT * FROM drafts WHERE workspace_id=? AND id=?')
      .bind(ctx.workspaceId, id)
      .first<Record<string, unknown>>();
    if (!draft)
      throw new ApiError(404, 'draft_missing', 'No se encontró el borrador.');
    let payload;
    try {
      payload = typefullyPayload(
        serializeDraft(draft) as Content,
        input.channels,
        input.socialSetId,
      );
    } catch (error) {
      throw new ApiError(
        400,
        'invalid_typefully_content',
        (error as Error).message,
      );
    }
    const existing = await ctx.db
      .prepare(
        'SELECT revision,state,receipt FROM typefully_drafts WHERE workspace_id=? AND draft_id=? AND social_set_id=?',
      )
      .bind(ctx.workspaceId, id, payload.social_set_id)
      .first<{ revision: number; state: string; receipt: string | null }>();
    if (existing) {
      if (existing.state === 'created' && existing.receipt)
        return respond({
          reused: true,
          revision: existing.revision,
          receipt: JSON.parse(existing.receipt),
          message:
            'Este borrador ya tiene una copia en Typefully. Las ediciones posteriores no se han enviado.',
        });
      throw new ApiError(
        409,
        'typefully_creation_unconfirmed',
        'Hay un envío en curso o sin confirmar. Revisa Typefully antes de crear otra copia.',
      );
    }
    if (draft.revision !== input.revision)
      throw new ApiError(
        409,
        'revision_conflict',
        'El borrador cambió. Vuelve a abrirlo antes de enviar.',
      );
    const linked = await ctx.db
      .prepare(
        'SELECT page_id,remote_edited_at FROM notion_links WHERE workspace_id=? AND draft_id=?',
      )
      .bind(ctx.workspaceId, id)
      .first<{ page_id: string; remote_edited_at: string }>();
    if (linked) {
      const remote = await readNotionPage(linked.page_id);
      if (remote.last_edited_time !== linked.remote_edited_at)
        throw new ApiError(
          409,
          'notion_changed',
          'Notion cambió desde la última importación. Compara e incorpora sus cambios antes de enviar.',
        );
      const properties = remote.properties;
      if (properties['Typefully URL']?.url)
        throw new ApiError(
          409,
          'typefully_already_linked',
          'Notion ya tiene un borrador en Typefully. Abre ese enlace para evitar duplicarlo.',
        );
      if (
        Object.values(properties).some(
          (value) => Array.isArray(value?.files) && value.files!.length,
        )
      )
        throw new ApiError(
          409,
          'media_not_supported',
          'El registro de Notion contiene archivos. La carga de medios aún no está disponible; no se enviará una copia incompleta.',
        );
    }
    const connection = await typefullyConnections();
    const group = connection.groups.find(
      (group) => group.id === String(payload.social_set_id),
    );
    if (
      connection.state !== 'read_verified' ||
      !group ||
      Object.keys(payload.platforms).some(
        (platform) => !group.channelIds.includes(group.id + ':' + platform),
      )
    )
      throw new ApiError(
        409,
        'typefully_account_unavailable',
        'No se pudieron verificar las cuentas seleccionadas en ese grupo.',
      );
    const claim = await ctx.db
      .prepare(
        "INSERT INTO typefully_drafts (workspace_id,draft_id,social_set_id,revision,state,created_by,created_at) SELECT workspace_id,id,?,revision,'creating',?,? FROM drafts WHERE workspace_id=? AND id=? AND revision=? ON CONFLICT DO NOTHING",
      )
      .bind(
        payload.social_set_id,
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
        'typefully_creation_conflict',
        'El borrador cambió o ya se está enviando. Consulta su estado antes de continuar.',
      );
    try {
      const receipt = typefullyReceipt(
        await createPrivateTypefullyDraft(payload),
      );
      await ctx.db
        .prepare(
          "UPDATE typefully_drafts SET state='created',receipt=? WHERE workspace_id=? AND draft_id=? AND social_set_id=? AND state='creating'",
        )
        .bind(
          JSON.stringify(receipt),
          ctx.workspaceId,
          id,
          payload.social_set_id,
        )
        .run();
      return respond({ revision: input.revision, receipt, reused: false }, 201);
    } catch {
      // Keep the claim even on timeout: the upstream may have created the draft.
      throw new ApiError(
        502,
        'typefully_creation_unconfirmed',
        'No se pudo confirmar el resultado. El envío no se repetirá automáticamente; revisa Typefully.',
      );
    }
  });
}
