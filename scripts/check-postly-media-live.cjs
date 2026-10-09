// Opt-in integration smoke: one synthetic PNG, no completion or social post.
require('ts-node/register');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const { PostlyMediaService } = require('../src/services/postly-media.service');
async function main() {
  if (process.env.OPEN_PUBLISHER_MEDIA_STAGING_TEST !== '1') throw Error('Explicit staging-test opt-in required.');
  const config = dotenv.parse(fs.readFileSync(process.argv[2] || 'publisher-web/.dev.vars'));
  const service = new PostlyMediaService(config.POSTLY_API_KEY || '');
  const directory = path.join(require('node:os').homedir(), '.local/share/open-publisher/postly-media-smoke');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const receipt = path.join(directory, 'attempt.json');
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  const attempt = {
    idempotencyKey: 'publisher-smoke:' + crypto.randomUUID(),
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    size: bytes.length, type: 'image/png',
    phase: 'creating_session', createdAt: new Date().toISOString(),
    finalized: false, socialPostCreated: false,
  };
  // Claim once. A rerun must inspect this receipt instead of making another object.
  const fd = fs.openSync(receipt, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(attempt)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  const persist = () => {
    const temp = receipt + '.tmp';
    const handle = fs.openSync(temp, 'wx', 0o600);
    try { fs.writeFileSync(handle, JSON.stringify(attempt)); fs.fsyncSync(handle); } finally { fs.closeSync(handle); }
    fs.renameSync(temp, receipt);
  };
  try {
    attempt.session = await service.createSession({ fileName: 'publisher-staging-smoke.png', size: bytes.length, type: attempt.type, idempotencyKey: attempt.idempotencyKey });
    attempt.phase = 'transferring'; persist();
    await service.transfer(attempt.session, new Blob([bytes], { type: attempt.type }));
    attempt.phase = 'transferred_not_finalized'; attempt.updatedAt = new Date().toISOString(); persist();
    console.log(JSON.stringify({ state: attempt.phase, size: attempt.size, finalized: false, socialPostCreated: false, receipt }));
  } catch (error) {
    attempt.lastErrorCode = ['invalid_input','rejected','outcome_unknown'].includes(error.code) ? error.code : 'local_error';
    attempt.updatedAt = new Date().toISOString(); persist();
    console.error(JSON.stringify({ state: attempt.phase, error: attempt.lastErrorCode, receipt, retryAutomatically: false }));
    process.exitCode = 1;
  }
}
main().catch(error => {
  console.error(error.code === 'EEXIST' ? 'An attempt already exists. Inspect its private receipt; do not create a duplicate.' : 'Staging smoke could not start; configuration or explicit opt-in missing.');
  process.exitCode = 1;
});
