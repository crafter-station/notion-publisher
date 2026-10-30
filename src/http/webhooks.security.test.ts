import assert from 'node:assert/strict';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { createPublisherRequestListener } from './create-server';
import { WEBHOOK_TOKEN_MIN_LENGTH } from './webhook-auth';

const TOKEN = 'w'.repeat(WEBHOOK_TOKEN_MIN_LENGTH);
const PAGE = { data: { id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } };

const WEBHOOKS = [
  '/webhooks/publish',
  '/webhooks/publish-gumroad',
  '/webhooks/unpublish-gumroad',
  '/webhooks/publish-postly',
  '/webhooks/publish-luma',
  '/webhooks/publish-github',
  '/webhooks/publish-composio',
  '/webhooks/publish-postiz',
  '/webhooks/publish-typefully',
  '/webhooks/publish-restream',
] as const;

const GATED_DRY_RUN = [
  '/webhooks/publish-postly',
  '/webhooks/publish-luma',
  '/webhooks/publish-github',
  '/webhooks/publish-gumroad',
] as const;

const originalFetch = globalThis.fetch;
let fetchCalls = 0;
let server: http.Server;
let base = '';

function post(
  path: string,
  opts: { token?: string; body?: unknown } = {}
): Promise<{ status: number; json: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, base);
    const payload = JSON.stringify(opts.body ?? PAGE);
    const headers: http.OutgoingHttpHeaders = {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(payload),
    };
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    const req = http.request(url, { method: 'POST', headers }, res => {
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let json: Record<string, unknown> = {};
        try {
          json = JSON.parse(raw || '{}');
        } catch {
          json = { raw };
        }
        resolve({ status: res.statusCode || 0, json });
      });
    });
    req.on('error', reject);
    req.end(payload);
  });
}

before(async () => {
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error('provider fetch must not run');
  }) as typeof fetch;
  server = http.createServer(createPublisherRequestListener(TOKEN));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  globalThis.fetch = originalFetch;
  await new Promise<void>((resolve, reject) => {
    server.close(err => (err ? reject(err) : resolve()));
  });
});

for (const path of WEBHOOKS) {
  test(`${path} returns 401 without a token`, async () => {
    const res = await post(path, { body: PAGE });
    assert.equal(res.status, 401);
    assert.equal(res.json.error, 'unauthorized');
  });

  test(`${path} returns 401 with a bad token`, async () => {
    const res = await post(path, { token: 'b'.repeat(32), body: PAGE });
    assert.equal(res.status, 401);
    assert.equal(res.json.error, 'unauthorized');
  });
}

for (const path of GATED_DRY_RUN) {
  test(`${path} dry-runs by default and does not call a provider`, async () => {
    const beforeCalls = fetchCalls;
    const res = await post(path, { token: TOKEN, body: PAGE });
    assert.equal(res.status, 202);
    assert.equal(res.json.dry_run, true);
    assert.equal(res.json.called_publish, false);
    assert.equal(res.json.notion_page_id, PAGE.data.id);
    assert.equal(typeof res.json.reason, 'string');
    assert.notEqual(res.json.reason, 'live');
    assert.equal(fetchCalls, beforeCalls);
  });
}

test('GET /capabilities does not require WEBHOOK_TOKEN', async () => {
  const res = await new Promise<{ status: number }>((resolve, reject) => {
    http
      .get(`${base}/capabilities`, response => {
        response.resume();
        response.on('end', () => resolve({ status: response.statusCode || 0 }));
      })
      .on('error', reject);
  });
  assert.equal(res.status, 200);
});
