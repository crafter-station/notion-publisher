require('ts-node/register');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createTypefullyDraftFromNotion: run } = require('../src/use-cases/create-typefully-draft.use-case');
const id = '123456781234123412341234567890ab', databaseId = 'abcdefabcdefabcdefabcdefabcdefab';
const rt = text => ({ rich_text: [{ text: { content: text } }] });
const receipt = { id: 123, status: 'draft', private_url: 'https://typefully.com/?d=123' };
async function main() {
 const root = await fs.mkdtemp(path.join(os.tmpdir(), 'publisher-workflow-'));
 const page = { id, parent: { database_id: databaseId }, properties: { 'Source Tags': { multi_select: [{ name: 'Typefully' }] }, 'Typefully Account': rt('33552'), Caption: rt('Private test'), Channels: { multi_select: [{ name: 'X' }] } } };
 let creations = 0, updates = 0;
 const deps = { databaseId, journalDirectory: path.join(root, 'normal'), getPage: async () => page, createDraft: async payload => { creations++; assert.equal(payload.publish_at, undefined); assert.equal(payload.share, false); return { successful: true, data: receipt }; }, updatePage: async (_, properties) => { updates++; assert.equal(properties['Typefully Publish Status'].status.name, 'In progress'); } };
 try {
  await run(id, deps); await run(id, deps);
  assert.equal(creations, 1); assert.equal(updates, 1);
  const retryDeps = { ...deps, journalDirectory: path.join(root, 'retry'), updatePage: async () => { throw new Error('Notion unavailable'); } };
  await assert.rejects(run(id, retryDeps), /Notion unavailable/);
  const before = creations;
  await run(id, { ...retryDeps, updatePage: deps.updatePage });
  assert.equal(creations, before, 'Notion failure must not recreate upstream draft');
  const ambiguous = { ...deps, journalDirectory: path.join(root, 'uncertain'), createDraft: async () => { throw new Error('timeout'); } };
  await assert.rejects(run(id, ambiguous), /timeout/);
  await assert.rejects(run(id, { ...ambiguous, createDraft: deps.createDraft }), /uncertain/);
  assert.equal(creations, before);
  await assert.rejects(run(id, { ...deps, getPage: async () => ({ ...page, parent: { database_id: id } }) }), /outside/);
  await assert.rejects(run('../evil', deps), /Invalid/);
  const concurrent = { ...deps, journalDirectory: path.join(root, 'concurrent') };
  const count = creations;
  const results = await Promise.allSettled([run(id, concurrent), run(id, concurrent)]);
  assert.equal(creations, count + 1);
  assert.ok(results.some(r => r.status === 'fulfilled'));
  const bad = { ...deps, journalDirectory: path.join(root, 'bad'), createDraft: async () => ({ successful: true, data: { ...receipt, private_url: 'https://evil.example/draft' } }) };
  await assert.rejects(run(id, bad), /Unexpected/);
  await assert.rejects(run(id, bad), /uncertain/);
  console.log('Typefully workflow checks passed: writeback recovery, duplicate/concurrency guards, uncertain writes, database boundary and private draft response.');
 } finally { await fs.rm(root, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
