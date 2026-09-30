import { IncomingMessage, ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';

type Execute = (pageId: string) => Promise<unknown>;
class InputError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
/** Notion Send webhook supports custom headers. Only the page ID is trusted as input;
 * execution re-reads Notion, checks database membership and uses persisted job receipts.
 */
export function createTypefullyWebhook(token: string, execute: Execute) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const reply = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return reply(405, { error: 'method_not_allowed' }); }
    if (token.length < 32) return reply(503, { error: 'webhook_not_configured' });
    const supplied = Buffer.from(req.headers.authorization || '');
    const expected = Buffer.from('Bearer ' + token);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return reply(401, { error: 'unauthorized' });
    if (req.headers.origin) return reply(403, { error: 'browser_requests_not_supported' });
    if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json' || req.headers['content-encoding']) return reply(415, { error: 'json_required' });
    try {
      const raw = await readBody(req);
      let payload;
      try { payload = JSON.parse(raw); } catch { throw new InputError(400, 'invalid_json'); }
      const pageId = payload?.page_id ?? payload?.data?.id;
      if (typeof pageId !== 'string' || !/^(?:[a-f\d]{32}|[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12})$/i.test(pageId)) throw new InputError(400, 'invalid_page_id');
      if (payload?.page_id && payload?.data?.id && payload.page_id.replace(/-/g, '').toLowerCase() !== String(payload.data.id).replace(/-/g, '').toLowerCase()) throw new InputError(400, 'conflicting_page_ids');
      const result = await execute(pageId);
      return reply(200, { result });
    } catch (error) {
      if (error instanceof InputError) return reply(error.status, { error: error.message });
      // Never expose upstream bodies, credentials or filesystem paths to a caller.
      return reply(502, { error: 'draft_not_confirmed', action: 'Check Notion and the Typefully job receipt before retrying.' });
    }
  };
}
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    const cleanup = () => {
      clearTimeout(timer);
      req.off('data', data); req.off('end', end); req.off('error', fail); req.off('aborted', aborted);
    };
    const fail = (error: Error) => { cleanup(); req.resume(); reject(error); };
    const aborted = () => fail(new InputError(400, 'request_aborted'));
    const data = (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 1_000_000) return fail(new InputError(413, 'payload_too_large'));
      chunks.push(chunk);
    };
    const end = () => { cleanup(); resolve(Buffer.concat(chunks).toString('utf8')); };
    const timer = setTimeout(() => fail(new InputError(408, 'request_timeout')), 10000);
    req.on('data', data); req.on('end', end); req.on('error', fail); req.on('aborted', aborted);
  });
}
