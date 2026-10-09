import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stageMedia } from './open-publisher-media.mjs';
const dir = await mkdtemp(join(tmpdir(), 'publisher-media-client-'));
const bytes = Buffer.alloc(10 * 1024 * 1024 + 3, 37);
const filePath = join(dir, 'sample.mp4');
const journalPath = join(dir, 'journal.json');
await writeFile(filePath, bytes);
const input = {
  filePath,
  journalPath,
  draftId: 'draft1',
  declaredType: 'video/mp4',
};
let upload,
  creates = 0,
  completes = 0,
  lostCreation = true,
  lostPart = true,
  lostCompletion = true;
const received = new Map(),
  puts = [];
const server = createServer(async (req, res) => {
  assert.equal(req.headers.authorization, 'Bearer test-token');
  const send = (value) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(value));
  };
  if (req.url === '/api/v1/session') return send({ workspaceId: 'workspace1' });
  if (req.url === '/api/v1/media' && req.method === 'POST') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const meta = JSON.parse(raw);
    creates++;
    if (!upload)
      upload = {
        ...meta,
        id: 'media1',
        state: 'uploading',
        partBytes: 10 * 1024 * 1024,
        parts: [],
      };
    assert.equal(meta.idempotencyKey, upload.idempotencyKey);
    if (lostCreation) {
      lostCreation = false;
      res.destroy();
      return;
    }
    return send(upload);
  }
  if (req.method === 'GET') return send(upload);
  if (req.method === 'PUT') {
    assert.equal(req.headers['content-type'], 'application/octet-stream');
    const n = Number(new URL(req.url, 'http://test').searchParams.get('part'));
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    received.set(n, Buffer.concat(chunks));
    puts.push(n);
    upload.parts = [...received.keys()].map((partNumber) => ({
      partNumber,
      uploaded: 1,
    }));
    if (lostPart) {
      lostPart = false;
      res.destroy();
      return;
    }
    return send({ uploaded: true });
  }
  completes++;
  upload.state = 'ready';
  if (lostCompletion) {
    lostCompletion = false;
    res.destroy();
    return;
  }
  return send(upload);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
process.env.OPEN_PUBLISHER_URL = 'http://127.0.0.1:' + server.address().port;
process.env.OPEN_PUBLISHER_TOKEN = 'test-token';
try {
  await assert.rejects(stageMedia(input)); // session created, response lost
  const journal = JSON.parse(await readFile(journalPath, 'utf8'));
  assert(journal.idempotencyKey);
  assert.equal(journal.id, undefined);
  assert.equal((await stat(journalPath)).mode & 0o777, 0o600);
  assert(!JSON.stringify(journal).includes('test-token'));
  await assert.rejects(stageMedia(input)); // first part stored, response lost
  assert.equal(creates, 2);
  assert.deepEqual(puts, [1]);
  await writeFile(filePath, Buffer.alloc(bytes.length, 38));
  await assert.rejects(stageMedia(input), /does not match/);
  assert.equal(creates, 2);
  assert.deepEqual(puts, [1]);
  await writeFile(filePath, bytes);
  await assert.rejects(stageMedia(input)); // second part and completion stored, response lost
  assert.deepEqual(puts, [1, 2]);
  assert.equal(completes, 1);
  assert.equal((await stageMedia(input)).state, 'ready');
  assert.deepEqual(Buffer.concat([received.get(1), received.get(2)]), bytes);
  assert.equal(completes, 1);
  assert.equal(creates, 2);
  await assert.rejects(
    stageMedia({ ...input, draftId: 'different' }),
    /does not match/,
  );
  console.log(
    'Media CLI passed: durable private journal, bounded binary parts, changed-file rejection, and resume after lost creation/part/completion responses without duplicate transfers.',
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
}
