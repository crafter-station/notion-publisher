import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const files = ['lib/server/context.ts', 'lib/channel-settings.ts', 'lib/server/drafts.ts', 'lib/server/publication-sets.ts'];
const source = 'const connectionReaders=globalThis.setReaders; const env=globalThis.setEnv; const getChatGPTUser=async()=>null;\n' + (await Promise.all(files.map(read))).join('\n').replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?/gm, '').replaceAll('import.meta.env.DEV', 'false');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const db = new DatabaseSync(':memory:');
for (const file of (await readdir(new URL('../drizzle/', import.meta.url))).filter(file => file.endsWith('.sql')).sort()) db.exec(await read('drizzle/' + file));
globalThis.setEnv = { DB: { prepare(sql) { return { bind(...args) { return { first: async () => db.prepare(sql).get(...args) || null, all: async () => ({ results: db.prepare(sql).all(...args) }), run: async () => ({ meta: { changes: db.prepare(sql).run(...args).changes } }) }; } }; } } };
let providerReads = 0;
const inventory = {provider:'typefully',state:'read_verified',checkedAt:'2026-09-27T00:00:00Z',message:'Fixture',accounts:[{id:'1:x',name:'Fixture',channel:'x',connected:true,hidden:false}],groups:[{id:'1',name:'Fixture',channelIds:['1:x']}]};
globalThis.setReaders = { typefully: async () => { providerReads++; return inventory; }, postly: async () => { throw new Error('Unavailable'); } };
try {
 const api = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
 const tokens = {};
 for (const [user, workspace, role, access, letter] of [['editor','a','editor','write','a'],['reader','a','editor','read','b'],['approver','a','approver','write','c'],['other','b','editor','write','d']]) {
   const token = 'op_' + letter.repeat(64); tokens[user] = token;
   db.prepare('INSERT INTO members VALUES(?,?,?,?)').run(workspace,user,user+'@example.test',role);
   db.prepare('INSERT INTO api_tokens(id,token_hash,workspace_id,user_id,name,access,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)').run(user,await api.hashToken(token),workspace,user,user,access,'now','2099-01-01');
 }
 const id = '11111111-1111-4111-8111-111111111111';
 const body = { id, name: 'Brand', accounts: [{ provider: 'typefully', accountId: '1:x', sourceGroupId: '1' }, { provider: 'postly', accountId: 'xyz' }] };
 const req = (user, method='GET', value, path='sets') => new Request('https://publisher.example/api/v1/'+path, { method, headers: user ? { Authorization:'Bearer '+tokens[user] } : {}, ...(value === undefined ? {} : { body:JSON.stringify(value) }) });
 const run = fn => api.handle(fn);
 assert.equal((await run(()=>api.listPublicationSets(req(null)))).status,401);
 for (const user of ['reader','approver']) assert.equal((await run(()=>api.createPublicationSet(req(user,'POST',body)))).status,403);
 const created = await run(()=>api.createPublicationSet(req('editor','POST',body))); assert.equal(created.status,201);
 const data = await created.json(); assert.equal(data.revision,1); assert.equal(data.publicationAuthorized,false); assert.equal(data.accountVerification,'not_checked'); assert.deepEqual(data.accounts,body.accounts);
 assert.equal((await run(()=>api.createPublicationSet(req('editor','POST',body)))).status,200);
 assert.equal((await run(()=>api.createPublicationSet(req('editor','POST',{...body,name:'Different'})))).status,409);
 assert.equal((await run(()=>api.getPublicationSet(req('other'),id))).status,404);
 assert.deepEqual((await (await run(()=>api.listPublicationSets(req('other')))).json()).items,[]);
 assert.equal((await run(()=>api.updatePublicationSet(req('other','PATCH',{...body,revision:1}),id))).status,404);
 assert.equal((await run(()=>api.createPublicationSet(req('editor','POST',{...body,accounts:[body.accounts[0],body.accounts[0]]})))).status,400);
 assert.equal((await run(()=>api.updatePublicationSet(req('reader','PATCH',{...body,revision:1}),id))).status,403);
 const updated=await run(()=>api.updatePublicationSet(req('editor','PATCH',{...body,name:'New brand',revision:1}),id)); assert.equal(updated.status,200); assert.equal((await updated.json()).revision,2);
 assert.equal((await run(()=>api.updatePublicationSet(req('editor','PATCH',{...body,revision:1}),id))).status,409);
 assert.equal((await run(()=>api.createPublicationSet(req('editor','POST',body)))).status,409);
 assert.equal((await run(()=>api.getPublicationSet(req('reader'),id))).status,200);

 const verify = user => run(()=>api.verifyPublicationSet(req(user,'GET',undefined,'sets/'+id+'/verify'),id));
 assert.equal((await verify(null)).status,401);
 assert.equal((await verify('other')).status,404);
 assert.equal(providerReads,0);
 const verification = await (await verify('reader')).json();
 assert.equal(verification.revision,2);
 assert.equal(verification.publicationAuthorized,false);
 assert.deepEqual(verification.items.map(item=>item.state),['reference_verified','read_failed']);
 const state = async () => (await (await verify('reader')).json()).items[0].state;
 inventory.accounts[0].connected=false; assert.equal(await state(),'account_disconnected');
 inventory.accounts[0].connected=true; inventory.accounts[0].hidden=true; assert.equal(await state(),'account_hidden');
 inventory.accounts[0].hidden=false; inventory.groups[0].channelIds=[]; assert.equal(await state(),'group_membership_mismatch');
 inventory.groups=[]; assert.equal(await state(),'group_missing');
 inventory.accounts=[]; assert.equal(await state(),'account_missing');
 for (const value of ['missing_configuration','subscription_required','read_failed']) { inventory.state=value; assert.equal(await state(),value); }
 delete globalThis.setReaders.typefully; assert.equal(await state(),'unsupported_provider');
 assert.equal((await (await run(()=>api.getPublicationSet(req('reader'),id))).json()).revision,2);
 for(let i=0;i<51;i++) db.prepare('INSERT INTO publication_sets VALUES(?,?,?,?,?,?,?,?,?)').run('22222222-2222-4222-8222-'+String(i).padStart(12,'0'),'a','Fixture','[]',1,'editor','editor','now','now');
 const page = await (await run(()=>api.listPublicationSets(req('reader')))).json(); assert.equal(page.items.length,50); assert(page.nextCursor);
 const tail = await (await run(()=>api.listPublicationSets(req('reader','GET',undefined,'sets?after='+page.nextCursor)))).json(); assert.equal(tail.items.length,2); assert.equal(tail.nextCursor,null); assert.equal(new Set([...page.items,...tail.items].map(item=>item.id)).size,52);
 console.log('Publication sets passed: real auth and migrations, workspace separation, editor/read/approver roles, idempotent create, stale revision conflict, duplicate references and pagination. No provider actions.');
} finally { delete globalThis.setReaders; delete globalThis.setEnv; db.close(); }
