#!/usr/bin/env node
import { open, readFile, rename, unlink } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { connectionOptions, request } from './open-publisher-client.mjs';

const partBytes = 10 * 1024 * 1024;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function part(file, size, index) {
  const bytes = Buffer.alloc(Math.min(partBytes, size - index * partBytes));
  let offset = 0;
  while (offset < bytes.length) {
    const { bytesRead } = await file.read(
      bytes,
      offset,
      bytes.length - offset,
      index * partBytes + offset,
    );
    if (!bytesRead) throw new Error('File changed or ended while reading.');
    offset += bytesRead;
  }
  return bytes;
}
async function persist(path, value, initial = false) {
  const target = initial ? path : path + '.' + randomUUID() + '.tmp';
  const file = await open(target, 'wx', 0o600);
  try {
    await file.writeFile(JSON.stringify(value, null, 2) + '\n');
    await file.sync();
  } finally {
    await file.close();
  }
  if (!initial) {
    try {
      await rename(target, path);
    } catch (error) {
      await unlink(target).catch(() => {});
      throw error;
    }
  }
}

// The journal is durable before the first remote mutation. No credentials or bytes
// are stored in it. Re-running reconciles server progress using the same key.
export async function stageMedia(
  { filePath, draftId, declaredType, journalPath },
  progress = () => {},
) {
  if (
    !filePath ||
    !journalPath ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(draftId || '') ||
    !/^(image|video|audio)\/[a-zA-Z0-9.+-]+$/.test(declaredType || '')
  )
    throw new Error(
      'Supply filePath, journalPath, draftId and an image/video/audio declaredType.',
    );
  if (resolve(filePath) === resolve(journalPath))
    throw new Error('Journal must be separate from the media file.');
  const { base } = connectionOptions();
  const { workspaceId } = await request('/api/v1/session');
  if (!workspaceId) throw new Error('Missing workspace identity.');
  const file = await open(filePath, 'r');
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size < 1 || stat.size > 5 * 1024 ** 3)
      throw new Error('Expected a nonempty regular file, at most 5 GiB.');
    const expected = {
      version: 1,
      origin: base.origin,
      workspaceId,
      draftId,
      fileName: basename(filePath),
      size: stat.size,
      declaredType,
      partBytes,
      hashes: [],
    };
    for (let i = 0; i < Math.ceil(stat.size / partBytes); i++)
      expected.hashes.push(hash(await part(file, stat.size, i)));
    let journal;
    try {
      journal = JSON.parse(await readFile(journalPath, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      journal = { ...expected, idempotencyKey: 'cli:' + randomUUID() };
      await persist(journalPath, journal, true);
    }
    for (const key of Object.keys(expected)) {
      if (JSON.stringify(journal[key]) !== JSON.stringify(expected[key]))
        throw new Error(
          'Journal does not match this file, workspace or draft. Resume with the original inputs.',
        );
    }
    if (!/^cli:[a-zA-Z0-9-]+$/.test(journal.idempotencyKey || ''))
      throw new Error('Invalid journal key.');
    if (journal.id && !/^[a-zA-Z0-9_-]{1,100}$/.test(journal.id))
      throw new Error('Invalid journal upload ID.');
    let session = journal.id
      ? await request('/api/v1/media/' + journal.id)
      : await request('/api/v1/media', 'POST', {
          draftId,
          idempotencyKey: journal.idempotencyKey,
          fileName: expected.fileName,
          size: stat.size,
          declaredType,
        });
    if (
      !/^[a-zA-Z0-9_-]{1,100}$/.test(session.id || '') ||
      session.draftId !== draftId ||
      session.size !== stat.size ||
      session.declaredType !== declaredType ||
      session.fileName !== expected.fileName ||
      session.partBytes !== partBytes
    )
      throw new Error(
        'Unexpected upload metadata. Keep the journal and inspect the server session.',
      );
    journal.id = session.id;
    await persist(journalPath, journal);
    if (!['uploading', 'completing', 'ready'].includes(session.state))
      throw new Error(
        'Upload state ' +
          session.state +
          ': keep this journal; do not create another upload.',
      );
    const endpoint = '/api/v1/media/' + session.id;
    if (session.state === 'uploading') {
      for (let i = 0; i < expected.hashes.length; i++) {
        if (!session.parts.some((p) => p.partNumber === i + 1 && p.uploaded)) {
          const bytes = await part(file, stat.size, i);
          if (hash(bytes) !== expected.hashes[i])
            throw new Error(
              'File changed during upload. Restore the original before resuming.',
            );
          await request(endpoint + '?part=' + (i + 1), 'PUT', bytes, {
            binary: true,
          });
        }
        progress({
          id: session.id,
          confirmedBytes: Math.min((i + 1) * partBytes, stat.size),
          totalBytes: stat.size,
        });
      }
    }
    if (session.state !== 'ready') session = await request(endpoint, 'POST');
    if (session.state !== 'ready')
      throw new Error('Completion not confirmed. Keep the journal and resume.');
    return session;
  } finally {
    await file.close();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (process.argv.includes('--help')) {
    console.log(
      'Private media staging: JSON on stdin {filePath,draftId,declaredType,journalPath}.\nUse an existing private directory for the journal. Re-run the same inputs to resume.\nUses OPEN_PUBLISHER_URL / TOKEN and optional SITES_TOKEN. Progress: stderr; result: stdout.\nDoes not attach, approve, schedule or publish. Attach returned id with a revision-checked draft update.',
    );
  } else {
    try {
      let input = '';
      for await (const chunk of process.stdin) {
        input += chunk;
        if (input.length > 16384) throw new Error('Input too large.');
      }
      console.log(
        JSON.stringify(
          await stageMedia(JSON.parse(input), (event) =>
            console.error(JSON.stringify(event)),
          ),
          null,
          2,
        ),
      );
    } catch (error) {
      console.error(JSON.stringify({ error: error.message }));
      process.exitCode = 1;
    }
  }
}
