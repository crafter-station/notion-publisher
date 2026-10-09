// Explicit Composio API or local CLI transport. No scheduler is started; this command creates an unpublished draft.
require('ts-node/register/transpile-only');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createTypefullyDraftFromNotion } = require('../src/use-cases/create-typefully-draft.use-case');
function execute(draft) {
  return new Promise((resolve, reject) => {
    const child = spawn('composio', ['execute', 'TYPEFULLY_CREATE_DRAFT', '-d', '-'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', failed = false;
    const fail = () => { failed = true; child.kill(); reject(new Error('Composio response uncertain; inspect the draft journal and Typefully before retrying.')); };
    const timer = setTimeout(fail, 60000);
    child.stdout.on('data', data => { output += data; if (Buffer.byteLength(output) > 2_000_000) fail(); });
    child.stderr.resume(); // Provider errors can include content; do not echo them.
    child.stdin.on('error', fail);
    child.on('error', fail);
    child.on('close', code => {
      clearTimeout(timer);
      if (failed) return;
      if (code !== 0) return fail();
      try { resolve(JSON.parse(output)); } catch { fail(); }
    });
    child.stdin.end(JSON.stringify(draft));
  });
}
async function main() {
  const [envFile, pageId, confirmation] = process.argv.slice(2);
  if (!envFile || !pageId || !['--create-draft-via-cli', '--create-draft-via-api'].includes(confirmation)) throw new Error('Usage: node scripts/create-typefully-notion.cjs ENV_FILE PAGE_ID --create-draft-via-api (or --create-draft-via-cli)');
  const env = { ...require('dotenv').parse(fs.readFileSync(envFile)), ...process.env };
  if (!env.NOTION_TOKEN || !env.NOTION_DATABASE_ID) throw new Error('Missing Notion configuration');
  let createDraft = execute;
  const viaApi = confirmation === '--create-draft-via-api';
  if (viaApi) {
    if (!env.COMPOSIO_API_KEY || !env.COMPOSIO_USER_ID || !env.COMPOSIO_TYPEFULLY_CONNECTED_ACCOUNT_ID) throw new Error('Missing Composio Typefully server configuration');
    const { ComposioService } = require('../src/services/composio.service');
    const composio = new ComposioService(env.COMPOSIO_API_KEY);
    let auth;
    try { auth = await composio.resolveTypefullyAccount(env.COMPOSIO_TYPEFULLY_CONNECTED_ACCOUNT_ID, env.COMPOSIO_USER_ID); }
    catch { throw new Error('Could not verify the configured Typefully server connection'); }
    createDraft = async draft => {
      try { return await composio.createTypefullyDraft(draft, auth); }
      catch { throw new Error('Typefully API outcome uncertain; reconcile the job journal before retrying.'); }
    };
  }
  async function notion(route, body) {
    const response = await fetch('https://api.notion.com/v1/' + route, {
      headers: { Authorization: 'Bearer ' + env.NOTION_TOKEN, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
      method: body ? 'PATCH' : 'GET', body: body && JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error('Notion request failed: HTTP ' + response.status);
    return response.json();
  }
  const result = await createTypefullyDraftFromNotion(pageId, {
    databaseId: env.NOTION_DATABASE_ID,
    journalDirectory: path.resolve(__dirname, '../data/typefully-jobs'),
    getPage: id => notion('pages/' + id),
    createDraft,
    updatePage: (id, properties) => notion('pages/' + id, { properties }),
  });
  console.log(JSON.stringify({ transport: viaApi ? 'composio-api' : 'local-composio-cli', ...result }, null, 2));
}
main().catch(error => { console.error(error instanceof TypeError ? 'Network or response failure; check the job journal before retrying.' : error.message); process.exitCode = 1; });
