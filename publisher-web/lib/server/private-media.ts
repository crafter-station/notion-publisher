// Internal R2 operations. Callers must authenticate, load sessions from D1 and
// persist claims/part receipts before exposing these operations through API/MCP.
export const MEDIA_PART_BYTES = 10 * 1024 * 1024;
export const MAX_MEDIA_BYTES = 5 * 1024 * 1024 * 1024;
export type PrivateMediaSession = {
  workspaceId: string;
  assetId: string;
  uploadId: string;
  size: number;
  declaredType: string;
};
function objectKey(workspaceId: string, assetId: string) {
  if (
    !/^[a-zA-Z0-9_-]{1,100}$/.test(workspaceId) ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(assetId)
  )
    throw new Error('Invalid media owner or asset ID.');
  return `private-media/${workspaceId}/${assetId}`;
}
function validate(session: PrivateMediaSession, workspaceId: string) {
  if (session.workspaceId !== workspaceId)
    throw new Error('Media belongs to another workspace.');
  if (
    !Number.isSafeInteger(session.size) ||
    session.size < 1 ||
    session.size > MAX_MEDIA_BYTES
  )
    throw new Error('Invalid media size.');
  return objectKey(workspaceId, session.assetId);
}
export async function startPrivateMedia(
  bucket: R2Bucket,
  input: Omit<PrivateMediaSession, 'uploadId'>,
): Promise<PrivateMediaSession> {
  const key = validate({ ...input, uploadId: '' }, input.workspaceId);
  if (!/^(image|video|audio)\/[a-zA-Z0-9.+-]+$/.test(input.declaredType))
    throw new Error('Unsupported declared media type.');
  const upload = await bucket.createMultipartUpload(key, {
    httpMetadata: {
      contentType: 'application/octet-stream',
      cacheControl: 'private, no-store',
    },
    customMetadata: {
      workspaceId: input.workspaceId,
      assetId: input.assetId,
      declaredType: input.declaredType,
      expectedSize: String(input.size),
    },
  });
  return { ...input, uploadId: upload.uploadId };
}
export function privatePartSize(
  session: PrivateMediaSession,
  partNumber: number,
) {
  validate(session, session.workspaceId);
  const count = Math.ceil(session.size / MEDIA_PART_BYTES);
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > count)
    throw new Error('Invalid media part number.');
  return Math.min(
    MEDIA_PART_BYTES,
    session.size - (partNumber - 1) * MEDIA_PART_BYTES,
  );
}
export async function putPrivateMediaPart(
  bucket: R2Bucket,
  workspaceId: string,
  session: PrivateMediaSession,
  partNumber: number,
  bytes: ArrayBuffer,
): Promise<R2UploadedPart> {
  const key = validate(session, workspaceId);
  if (bytes.byteLength !== privatePartSize(session, partNumber))
    throw new Error('Media part has the wrong byte length.');
  return bucket
    .resumeMultipartUpload(key, session.uploadId)
    .uploadPart(partNumber, bytes);
}
function matches(object: R2Object, session: PrivateMediaSession) {
  if (
    object.size !== session.size ||
    object.customMetadata?.workspaceId !== session.workspaceId ||
    object.customMetadata?.assetId !== session.assetId ||
    object.customMetadata?.declaredType !== session.declaredType
  )
    throw new Error('Stored media does not match the upload session.');
  return { assetId: session.assetId, size: object.size, etag: object.etag };
}
export async function completePrivateMedia(
  bucket: R2Bucket,
  workspaceId: string,
  session: PrivateMediaSession,
  parts: R2UploadedPart[],
) {
  const key = validate(session, workspaceId);
  const expected = Math.ceil(session.size / MEDIA_PART_BYTES);
  if (
    parts.length !== expected ||
    parts.some((part, index) => part.partNumber !== index + 1 || !part.etag)
  )
    throw new Error(
      'A complete ordered set of media part receipts is required.',
    );
  // HEAD reconciles a lost completion response. Unique asset IDs must be claimed
  // durably by the caller; never reuse one for another file or upload attempt.
  const existing = await bucket.head(key);
  if (existing) return matches(existing, session);
  const object = await bucket
    .resumeMultipartUpload(key, session.uploadId)
    .complete(parts);
  return matches(object, session);
}
export async function abortPrivateMedia(
  bucket: R2Bucket,
  workspaceId: string,
  session: PrivateMediaSession,
) {
  const key = validate(session, workspaceId);
  // Aborting an unfinished multipart session does not delete a completed asset.
  await bucket.resumeMultipartUpload(key, session.uploadId).abort();
}

export async function readPrivateMedia(
  bucket: R2Bucket,
  workspaceId: string,
  session: PrivateMediaSession,
) {
  return bucket.get(validate(session, workspaceId));
}
