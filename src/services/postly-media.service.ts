/** Postly media staging. No method creates a social post or retries a write.
 * Contract: https://docs.postly.ai/openapi.yaml
 * Keep session URLs private; completion makes the stored media public.
 */
export interface PostlyUploadSession {
  upload_url: string;
  file_path: string;
  type: string;
  size: number;
}
export interface PostlyUploadedMedia { url: string; type: string; size: number }
export class PostlyMediaError extends Error {
  constructor(public readonly code: 'invalid_input' | 'rejected' | 'outcome_unknown', message: string) {
    super(message);
  }
}
function invalid(message: string): never { throw new PostlyMediaError('invalid_input', message); }
function key(value: string) {
  if (!/^[A-Za-z0-9._:-]{1,200}$/.test(value)) invalid('A stable media idempotency key is required.');
}
function httpsUrl(value: unknown): URL {
  try {
    const url = new URL(String(value));
    if (url.protocol === 'https:' && !url.username && !url.password && !url.hash) return url;
  } catch { /* Return a constant error, never the signed URL. */ }
  return invalid('Invalid media URL.');
}
function media(value: unknown): PostlyUploadedMedia {
  const item = value as Partial<PostlyUploadedMedia> | null;
  if (!item || typeof item.url !== 'string' || typeof item.type !== 'string' || !Number.isSafeInteger(item.size) || item.size! <= 0)
    throw new PostlyMediaError('outcome_unknown', 'Media response was incomplete; reconcile using the same key.');
  httpsUrl(item.url);
  return { url: item.url, type: item.type, size: item.size! };
}
export class PostlyMediaService {
  constructor(private readonly apiKey: string) {
    if (!apiKey.trim()) invalid('Postly credential is missing.');
  }
  private async request(path: string, body: unknown, idempotencyKey?: string) {
    let response: Response;
    try {
      response = await fetch('https://openapi.postly.ai/v1' + path, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
        headers: { 'X-API-Key': this.apiKey, 'Content-Type': 'application/json',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
        body: JSON.stringify(body),
      });
    } catch {
      throw new PostlyMediaError('outcome_unknown', 'Postly did not return a conclusive response; reconcile before retrying.');
    }
    if (response.status === 202) return { pending: true as const, data: null };
    if (!response.ok) throw new PostlyMediaError(response.status >= 500 ? 'outcome_unknown' : 'rejected', `Postly media request returned HTTP ${response.status}.`);
    try { return { pending: false as const, data: (await response.json()).data as unknown }; }
    catch { throw new PostlyMediaError('outcome_unknown', 'Postly returned an unreadable response; reconcile before retrying.'); }
  }
  async createSession(input: { fileName: string; size: number; type: string; idempotencyKey: string }): Promise<PostlyUploadSession> {
    key(input.idempotencyKey);
    if (!input.fileName.trim() || /[\x00-\x1f]/.test(input.fileName) || !Number.isSafeInteger(input.size) || input.size <= 0 || !/^(video|image)\/[a-zA-Z0-9.+-]+$/.test(input.type))
      invalid('A file name, positive byte size and media MIME type are required.');
    const result = await this.request('/files/upload-session', { file_name: input.fileName, size: input.size, type: input.type }, input.idempotencyKey);
    const item = result.data as Partial<PostlyUploadSession> | null;
    if (result.pending || !item || typeof item.file_path !== 'string' || !item.file_path || typeof item.upload_url !== 'string' || item.size !== input.size || item.type !== input.type)
      throw new PostlyMediaError('outcome_unknown', 'Upload session response was incomplete; retain the same idempotency key.');
    this.storageUrl(item.upload_url);
    return { upload_url: item.upload_url, file_path: item.file_path, type: item.type, size: item.size };
  }
  private storageUrl(value: string) {
    const url = httpsUrl(value);
    // Current documented session contract uses Google Storage. Do not send files
    // to arbitrary hosts supplied in an altered session or a redirect.
    if (url.hostname !== 'storage.googleapis.com' || url.port) invalid('Unsupported upload storage host.');
    return url;
  }
  async transfer(session: PostlyUploadSession, file: Blob): Promise<void> {
    const url = this.storageUrl(session.upload_url);
    if (file.size !== session.size || file.type !== session.type || file.size <= 0) invalid('File size or MIME type does not match its upload session.');
    let response: Response;
    try {
      response = await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': session.type }, redirect: 'error', signal: AbortSignal.timeout(300000) });
    } catch { throw new PostlyMediaError('outcome_unknown', 'File transfer outcome is unknown; do not create a second upload.'); }
    if (!response.ok) throw new PostlyMediaError(response.status >= 500 ? 'outcome_unknown' : 'rejected', `Storage transfer returned HTTP ${response.status}.`);
  }
  async complete(input: { filePath: string; idempotencyKey: string; allowPublicMedia: boolean }): Promise<PostlyUploadedMedia> {
    if (input.allowPublicMedia !== true) invalid('Completing this upload makes the media public and requires explicit authorization.');
    key(input.idempotencyKey);
    if (!input.filePath.trim()) invalid('An upload file path is required.');
    const result = await this.request('/files/upload-session/complete', { file_path: input.filePath }, input.idempotencyKey);
    if (result.pending) throw new PostlyMediaError('outcome_unknown', 'Upload completion is pending; reconcile using the same key.');
    return media(result.data);
  }
  async recover(idempotencyKey: string): Promise<{ state: 'pending' } | { state: 'completed'; media: PostlyUploadedMedia }> {
    key(idempotencyKey);
    const result = await this.request('/files/upload-status', { idempotency_key: idempotencyKey });
    return result.pending ? { state: 'pending' } : { state: 'completed', media: media(result.data) };
  }
}
