import { env } from 'cloudflare:workers';
import { ApiError, context, respond } from './context';
import { readInput } from './drafts';
import {
  beginMediaCompletion,
  claimMediaPart,
  claimMediaUpload,
  readMediaUpload,
  recordMediaCompletion,
  recordMediaPart,
  recordMediaSession,
  storedMediaSession,
  type MediaInput,
} from './media-uploads';
import {
  completePrivateMedia,
  readPrivateMedia,
  MEDIA_PART_BYTES,
  MAX_MEDIA_BYTES,
  privatePartSize,
  putPrivateMediaPart,
  startPrivateMedia,
} from './private-media';

function bucket() {
  const value = (env as unknown as { BUCKET?: R2Bucket }).BUCKET;
  if (!value)
    throw new ApiError(
      503,
      'media_storage_unavailable',
      'El almacenamiento de archivos no está disponible.',
    );
  return value;
}
async function mediaContext(request: Request, write = false) {
  const ctx = await context(request, write);
  if (write && ctx.role === 'approver')
    throw new ApiError(
      403,
      'editor_required',
      'La carga de archivos requiere un editor o administrador.',
    );
  return ctx;
}
async function getUpload(ctx: Awaited<ReturnType<typeof context>>, id: string) {
  const exists = await ctx.db
    .prepare('SELECT id FROM media_uploads WHERE workspace_id=? AND id=?')
    .bind(ctx.workspaceId, id)
    .first();
  if (!exists)
    throw new ApiError(404, 'media_not_found', 'No se encontró la carga.');
  return readMediaUpload(ctx, id);
}
async function inventory(ctx: Awaited<ReturnType<typeof context>>, id: string) {
  const row = await getUpload(ctx, id);
  const parts = await ctx.db
    .prepare(
      'SELECT part_number AS partNumber,size,etag IS NOT NULL AS uploaded FROM media_upload_parts WHERE upload_id=? ORDER BY part_number',
    )
    .bind(id)
    .all();
  const draft = await ctx.db
    .prepare('SELECT media_ids FROM drafts WHERE id=? AND workspace_id=?')
    .bind(row.draft_id, ctx.workspaceId)
    .first<{ media_ids: string }>();
  const attached = draft
    ? (JSON.parse(draft.media_ids) as string[]).includes(row.id)
    : false;
  return {
    id: row.id,
    draftId: row.draft_id,
    fileName: row.file_name,
    size: row.size,
    declaredType: row.declared_type,
    state: row.state,
    partBytes: MEDIA_PART_BYTES,
    parts: parts.results,
    attached,
    publishingVerified: false,
  };
}
export async function createMedia(request: Request) {
  const ctx = await mediaContext(request, true);
  const storage = bucket();
  const input = (await readInput(request)) as Partial<MediaInput> | null;
  if (
    !input ||
    typeof input.draftId !== 'string' ||
    typeof input.idempotencyKey !== 'string' ||
    !/^[A-Za-z0-9._:-]{1,200}$/.test(input.idempotencyKey) ||
    typeof input.fileName !== 'string' ||
    !input.fileName.trim() ||
    input.fileName.length > 255 ||
    Array.from(input.fileName).some((c) => c.charCodeAt(0) < 32) ||
    typeof input.size !== 'number' ||
    !Number.isSafeInteger(input.size) ||
    input.size < 1 ||
    input.size > MAX_MEDIA_BYTES ||
    typeof input.declaredType !== 'string' ||
    !/^(image|video|audio)\/[a-zA-Z0-9.+-]+$/.test(input.declaredType)
  )
    throw new ApiError(
      400,
      'invalid_media',
      'Indica borrador, clave de carga, nombre, tamaño y tipo de archivo válidos.',
    );
  const draft = await ctx.db
    .prepare('SELECT id FROM drafts WHERE workspace_id=? AND id=?')
    .bind(ctx.workspaceId, input.draftId)
    .first();
  if (!draft)
    throw new ApiError(404, 'draft_not_found', 'No se encontró el borrador.');
  let claim;
  try {
    claim = await claimMediaUpload(ctx, input as MediaInput);
  } catch {
    throw new ApiError(
      409,
      'media_claim_conflict',
      'La clave de carga ya está en uso o no pudo reservarse. Consulta la carga antes de repetir.',
    );
  }
  if (claim.claimed) {
    const session = await startPrivateMedia(storage, {
      workspaceId: ctx.workspaceId,
      assetId: claim.upload.id,
      size: claim.upload.size,
      declaredType: claim.upload.declared_type,
    });
    await recordMediaSession(ctx, claim.upload.id, session.uploadId);
  }
  return respond(
    await inventory(ctx, claim.upload.id),
    claim.claimed ? 201 : 200,
  );
}
export async function inspectMedia(request: Request, id: string) {
  const ctx = await mediaContext(request);
  if (new URL(request.url).searchParams.get('download') === '1') {
    const row = await getUpload(ctx, id);
    if (row.state !== 'ready')
      throw new ApiError(
        409,
        'media_not_ready',
        'El archivo todavía no está completo.',
      );
    const file = await readPrivateMedia(
      bucket(),
      ctx.workspaceId,
      storedMediaSession(row),
    );
    if (!file)
      throw new ApiError(404, 'media_not_found', 'No se encontró el archivo.');
    return new Response(file.body, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(file.size),
        'Content-Disposition':
          "attachment; filename*=UTF-8''" + encodeURIComponent(row.file_name),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
  return respond(await inventory(ctx, id));
}
async function boundedPart(request: Request, expected: number) {
  const reader = request.body?.getReader();
  if (!reader)
    throw new ApiError(
      400,
      'missing_media_part',
      'Faltan los bytes del archivo.',
    );
  const bytes = new Uint8Array(expected);
  let offset = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (offset + value.byteLength > expected) {
        await reader.cancel();
        throw new ApiError(
          413,
          'media_part_too_large',
          'La parte supera el tamaño esperado.',
        );
      }
      bytes.set(value, offset);
      offset += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  if (offset !== expected)
    throw new ApiError(400, 'media_part_size', 'La parte está incompleta.');
  return bytes.buffer;
}
export async function uploadMediaPart(request: Request, id: string) {
  const ctx = await mediaContext(request, true);
  const row = await getUpload(ctx, id);
  if (row.state !== 'uploading')
    throw new ApiError(409, 'media_state', 'La carga no admite nuevas partes.');
  const partNumber = Number(new URL(request.url).searchParams.get('part'));
  const session = storedMediaSession(row);
  let expected;
  try {
    expected = privatePartSize(session, partNumber);
  } catch {
    throw new ApiError(
      400,
      'invalid_media_part',
      'El número de parte no es válido.',
    );
  }
  const bytes = await boundedPart(request, expected);
  const sha = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    (v) => v.toString(16).padStart(2, '0'),
  ).join('');
  let part;
  try {
    part = await claimMediaPart(ctx, id, partNumber, bytes.byteLength, sha);
  } catch {
    throw new ApiError(
      409,
      'media_part_conflict',
      'Esta parte corresponde a otros bytes o la carga ya se está finalizando.',
    );
  }
  if (!part.etag) {
    // Same part + same persisted hash is safe to retransmit after a lost response.
    const receipt = await putPrivateMediaPart(
      bucket(),
      ctx.workspaceId,
      session,
      partNumber,
      bytes,
    );
    try {
      await recordMediaPart(ctx, id, partNumber, sha, receipt.etag);
    } catch {
      const saved = await ctx.db
        .prepare(
          'SELECT etag FROM media_upload_parts WHERE upload_id=? AND part_number=? AND sha256=?',
        )
        .bind(id, partNumber, sha)
        .first<{ etag: string }>();
      if (saved?.etag !== receipt.etag)
        throw new ApiError(
          409,
          'media_part_uncertain',
          'Consulta el estado antes de repetir la transferencia.',
        );
    }
  }
  return respond({ id, partNumber, uploaded: true });
}
export async function finishMedia(request: Request, id: string) {
  const ctx = await mediaContext(request, true);
  let row = await getUpload(ctx, id);
  if (row.state === 'ready') return respond(await inventory(ctx, id));
  if (row.state === 'uploading') {
    try {
      await beginMediaCompletion(ctx, id);
    } catch {
      throw new ApiError(
        409,
        'media_incomplete',
        'Faltan partes confirmadas o la finalización ya comenzó. Consulta el estado.',
      );
    }
    row = await getUpload(ctx, id);
  }
  if (row.state !== 'completing')
    throw new ApiError(
      409,
      'media_state',
      'La carga todavía no puede finalizarse.',
    );
  const parts = await ctx.db
    .prepare(
      'SELECT part_number AS partNumber,etag FROM media_upload_parts WHERE upload_id=? ORDER BY part_number',
    )
    .bind(id)
    .all<R2UploadedPart>();
  // Reconciles R2 completion after a lost response, using server-held receipts.
  const receipt = await completePrivateMedia(
    bucket(),
    ctx.workspaceId,
    storedMediaSession(row),
    parts.results,
  );
  try {
    await recordMediaCompletion(ctx, id, receipt.etag);
  } catch {
    if ((await getUpload(ctx, id)).etag !== receipt.etag)
      throw new ApiError(
        409,
        'media_completion_uncertain',
        'La finalización requiere comprobar el estado.',
      );
  }
  return respond(await inventory(ctx, id));
}
