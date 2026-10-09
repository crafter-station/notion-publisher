import { MAX_MEDIA_BYTES, MEDIA_PART_BYTES, privatePartSize } from './private-media';

type MediaContext = { db: D1Database; workspaceId: string; userId: string };
export type MediaUpload = {
  id: string; workspace_id: string; draft_id: string; idempotency_key: string;
  file_name: string; size: number; declared_type: string; upload_id: string | null;
  state: 'creating' | 'uploading' | 'completing' | 'ready' | 'aborted'; etag: string | null;
};
export type MediaInput = { draftId: string; idempotencyKey: string; fileName: string; size: number; declaredType: string };
// Internal persistence. HTTP callers must enforce write scope and editor role.
export async function readMediaUpload(ctx: MediaContext, id: string): Promise<MediaUpload> {
  const row = await ctx.db.prepare('SELECT * FROM media_uploads WHERE workspace_id=? AND id=?').bind(ctx.workspaceId, id).first<MediaUpload>();
  if (!row) throw new Error('Media upload not found.');
  return row;
}
export async function claimMediaUpload(ctx: MediaContext, input: MediaInput) {
  if (!/^[A-Za-z0-9._:-]{1,200}$/.test(input.idempotencyKey) || !input.fileName.trim() || input.fileName.length > 255 || Array.from(input.fileName).some(char => char.charCodeAt(0) < 32) || !Number.isSafeInteger(input.size) || input.size < 1 || input.size > MAX_MEDIA_BYTES || !/^(image|video|audio)\/[a-zA-Z0-9.+-]+$/.test(input.declaredType))
    throw new Error('Invalid media upload metadata.');
  const id = crypto.randomUUID();
  const result = await ctx.db.prepare(`INSERT INTO media_uploads (id,workspace_id,draft_id,idempotency_key,file_name,size,declared_type,state,created_by,created_at)
    SELECT ?,workspace_id,id,?,?,?,?, 'creating',?,? FROM drafts WHERE workspace_id=? AND id=?
    ON CONFLICT(workspace_id,idempotency_key) DO NOTHING`)
    .bind(id, input.idempotencyKey, input.fileName, input.size, input.declaredType, ctx.userId, new Date().toISOString(), ctx.workspaceId, input.draftId).run();
  const upload = await ctx.db.prepare('SELECT * FROM media_uploads WHERE workspace_id=? AND idempotency_key=?').bind(ctx.workspaceId, input.idempotencyKey).first<MediaUpload>();
  if (!upload) throw new Error('Draft not found in this workspace.');
  if (upload.draft_id !== input.draftId || upload.file_name !== input.fileName || upload.size !== input.size || upload.declared_type !== input.declaredType)
    throw new Error('Idempotency key already belongs to different media.');
  // Only the winner may create an R2 session. A duplicate still in creating is
  // uncertain, not permission to start another session.
  return { upload, claimed: result.meta.changes === 1 };
}
export async function recordMediaSession(ctx: MediaContext, id: string, uploadId: string) {
  if (!uploadId) throw new Error('Missing storage upload ID.');
  const result = await ctx.db.prepare("UPDATE media_uploads SET upload_id=?,state='uploading' WHERE workspace_id=? AND id=? AND state='creating' AND upload_id IS NULL").bind(uploadId, ctx.workspaceId, id).run();
  if (result.meta.changes !== 1) throw new Error('Media upload session is already recorded or unavailable.');
}
export function storedMediaSession(row: MediaUpload) {
  if (!row.upload_id) throw new Error('Media upload session is not ready.');
  return { workspaceId: row.workspace_id, assetId: row.id, uploadId: row.upload_id, size: row.size, declaredType: row.declared_type };
}
export async function claimMediaPart(ctx: MediaContext, id: string, partNumber: number, size: number, sha256: string) {
  const row = await readMediaUpload(ctx, id);
  if (row.state !== 'uploading' || size !== privatePartSize(storedMediaSession(row), partNumber) || !/^[a-f0-9]{64}$/.test(sha256)) throw new Error('Invalid media part or upload state.');
  const result = await ctx.db.prepare(`INSERT INTO media_upload_parts (upload_id,part_number,size,sha256)
    SELECT id,?,?,? FROM media_uploads WHERE workspace_id=? AND id=? AND state='uploading'
    ON CONFLICT(upload_id,part_number) DO NOTHING`).bind(partNumber, size, sha256, ctx.workspaceId, id).run();
  const part = await ctx.db.prepare('SELECT p.* FROM media_upload_parts p JOIN media_uploads u ON u.id=p.upload_id WHERE u.workspace_id=? AND u.id=? AND p.part_number=?').bind(ctx.workspaceId, id, partNumber).first<{ size: number; sha256: string; etag: string | null }>();
  if (!part || part.size !== size || part.sha256 !== sha256) throw new Error('Part is unavailable or already belongs to different bytes.');
  return { claimed: result.meta.changes === 1, etag: part.etag };
}
export async function recordMediaPart(ctx: MediaContext, id: string, partNumber: number, sha256: string, etag: string) {
  if (!etag) throw new Error('Missing storage part receipt.');
  const result = await ctx.db.prepare(`UPDATE media_upload_parts SET etag=? WHERE upload_id=? AND part_number=? AND sha256=? AND etag IS NULL
    AND EXISTS (SELECT 1 FROM media_uploads WHERE id=? AND workspace_id=? AND state='uploading')`).bind(etag, id, partNumber, sha256, id, ctx.workspaceId).run();
  if (result.meta.changes !== 1) throw new Error('Media part receipt cannot be replaced.');
}
export async function beginMediaCompletion(ctx: MediaContext, id: string) {
  const row = await readMediaUpload(ctx, id);
  const session = storedMediaSession(row);
  const count = Math.ceil(row.size / MEDIA_PART_BYTES);
  const result = await ctx.db.prepare(`UPDATE media_uploads SET state='completing' WHERE workspace_id=? AND id=? AND state='uploading'
    AND (SELECT COUNT(*) FROM media_upload_parts WHERE upload_id=? AND etag IS NOT NULL)=?`).bind(ctx.workspaceId, id, id, count).run();
  if (result.meta.changes !== 1) throw new Error('Completion already claimed or media parts are incomplete.');
  const parts = await ctx.db.prepare('SELECT part_number AS partNumber,etag FROM media_upload_parts WHERE upload_id=? ORDER BY part_number').bind(id).all<R2UploadedPart>();
  return { session, parts: parts.results };
}
export async function recordMediaCompletion(ctx: MediaContext, id: string, etag: string) {
  if (!etag) throw new Error('Missing storage completion receipt.');
  const result = await ctx.db.prepare("UPDATE media_uploads SET state='ready',etag=? WHERE workspace_id=? AND id=? AND state='completing'").bind(etag, ctx.workspaceId, id).run();
  if (result.meta.changes !== 1) throw new Error('Media completion cannot be replaced.');
}
