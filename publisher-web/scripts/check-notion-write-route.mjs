import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
import {readFile,readdir} from 'node:fs/promises';
const db=new DatabaseSync(':memory:');
for(const name of (await readdir(new URL('../drizzle/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort()) db.exec(await readFile(new URL('../drizzle/'+name,import.meta.url),'utf8'));
const rich=value=>({type:'rich_text',rich_text:[{plain_text:value}]});
let remote, writes=0, behavior='success', readCount=0;
const d1 = {
 prepare(sql) {
  return { bind(...args) {
   return {
    first: async () => db.prepare(sql).get(...args),
    all: async () => ({results: db.prepare(sql).all(...args)}),
    run: async () => ({meta: {changes: db.prepare(sql).run(...args).changes}}),
   };
  }};
 },
 async batch(items) {
  db.exec('BEGIN');
  try {const result=await Promise.all(items.map(i=>i.run()));db.exec('COMMIT');return result;}
  catch(e){db.exec('ROLLBACK');throw e;}
 }
};
globalThis.fixture={db:d1,async read(){readCount++;if(behavior==='changed-before'&&readCount===2)remote.last_edited_time='changed';return structuredClone(remote);},async write(id,patch){writes++;if(behavior==='timeout')throw new Error('timeout');for(const [name,value] of Object.entries(patch)){const type=Object.keys(value)[0];remote.properties[name]={type,[type]:value[type].map(v=>({plain_text:v.text.content}))};}remote.last_edited_time='after';if(behavior==='mismatch')remote.properties.Caption=rich('External edit');}};
const paths=['lib/channel-settings.ts','lib/postiz-versions.ts','lib/notion-content.ts','lib/notion-write-plan.ts','app/api/v1/drafts/[id]/notion/route.ts'];
let source=(await Promise.all(paths.map(p=>readFile(new URL('../'+p,import.meta.url),'utf8')))).join('\n').replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?/gm,'');
source=`class ApiError extends Error {constructor(public status:number,public code:string,message:string){super(message)}}
const context=async(request:Request,write=false)=>{if(request.headers.get('authorization')!=='write')throw new ApiError(403,'denied','Denied');return {db:globalThis.fixture.db,workspaceId:'w',userId:'u',role:globalThis.fixture.role||'administrator'}};
const requireAdministrator=(role:string)=>{if(role!=='administrator')throw new ApiError(403,'administrator_required','Administrator required')};
const readInput=(r:Request)=>r.json();
const serializeDraft=(d:any)=>({...d,versions:JSON.parse(d.versions),channelSettings:JSON.parse(d.channel_settings||'{}')});
const parseDraft=(d:any)=>({...d,versions:JSON.stringify(d.versions),channelSettings:JSON.stringify(d.channelSettings||{})});
const respond=(data:any,status=200)=>Response.json(data,{status});
const handle=async(fn:any)=>{try{return await fn()}catch(e){return respond({error:{code:e.code,message:e.message}},e.status||500)}};
const readNotionPage=()=>globalThis.fixture.read();
const writeNotionProperties=(id:any,patch:any)=>globalThis.fixture.write(id,patch);
`+source;
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {PUT,GET,PATCH,notionSnapshot}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
function reset(mode='success'){
 db.exec('DELETE FROM notion_writes; DELETE FROM notion_links; DELETE FROM drafts;');writes=0;readCount=0;behavior=mode;
 remote={id:'p',last_edited_time:'before',properties:{Name:{type:'title',title:[{plain_text:'Title'}]},Caption:rich('Original')}};
 db.prepare("INSERT INTO drafts(id,workspace_id,title,body,versions,status,revision,created_by,updated_by,created_at,updated_at) VALUES ('d','w','Title','Edited','{}','draft',1,'u','u','now','now')").run();
 db.prepare("INSERT INTO notion_links VALUES ('w','p','d','https://notion.so/p','before',?,'now')").run(notionSnapshot(remote.properties));
}
const call=(input={revision:1,remoteEditedAt:'before'},auth='write')=>PUT(new Request('https://test/api/v1/drafts/d/notion',{method:'PUT',headers:{authorization:auth,'Content-Type':'application/json'},body:JSON.stringify(input)}),{params:Promise.resolve({id:'d'})});
reset();assert.equal((await call(undefined,'read')).status,403);assert.equal(writes,0);
assert.equal((await call({revision:2,remoteEditedAt:'before'})).status,409);assert.equal(writes,0);
assert.equal((await call({revision:1,remoteEditedAt:'old'})).status,409);assert.equal(writes,0);
assert.equal((await call()).status,200);assert.equal(writes,1);assert.equal(db.prepare('SELECT state FROM notion_writes').get().state,'confirmed');
assert.equal((await call({revision:1,remoteEditedAt:'after'})).status,200);assert.equal(writes,1);
reset('timeout');assert.equal((await call()).status,502);assert.equal(db.prepare('SELECT state FROM notion_writes').get().state,'uncertain');assert.equal((await call()).status,409);assert.equal(writes,1);
reset('changed-before');assert.equal((await call()).status,409);assert.equal(writes,0);assert.equal(db.prepare('SELECT state FROM notion_writes').get().state,'cancelled');
reset('mismatch');assert.equal((await call()).status,502);assert.equal(db.prepare('SELECT state FROM notion_writes').get().state,'uncertain');
reset();const results=await Promise.all([call(),call()]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(writes,1);
const inventory=await GET(new Request('https://test/api/v1/drafts/d/notion',{headers:{authorization:'write'}}),{params:Promise.resolve({id:'d'})});assert.equal((await inventory.json()).attempts.length,1);
console.log('Notion write route passed against SQLite: authorization, stale inputs, confirmed readback, no-op, unique concurrent claim, timeout lock, pre-send cancellation and mismatched readback. Notion mocked; no external writes.');

const reconcile=(attemptId,action='confirm',remoteEditedAt=remote.last_edited_time)=>PATCH(new Request('https://test/api/v1/drafts/d/notion',{method:'PATCH',headers:{authorization:'write','Content-Type':'application/json'},body:JSON.stringify({attemptId,action,remoteEditedAt})}),{params:Promise.resolve({id:'d'})});
reset('timeout');await call();let attempt=db.prepare('SELECT id FROM notion_writes').get().id;
globalThis.fixture.role='editor';assert.equal((await reconcile(attempt)).status,403);delete globalThis.fixture.role;
assert.equal((await reconcile(attempt)).status,409);
db.prepare("UPDATE notion_writes SET created_at='2026-01-01T00:00:00.000Z'").run();
assert.equal((await reconcile(attempt,'confirm','old')).status,409);
assert.equal((await reconcile(attempt)).status,409);
const originalDraft=db.prepare('SELECT * FROM drafts').get();
assert.equal((await reconcile(attempt,'keep_notion')).status,200);assert.equal(writes,1);
assert.equal(db.prepare('SELECT state FROM notion_writes').get().state,'cancelled');assert.deepEqual(db.prepare('SELECT * FROM drafts').get(),originalDraft);
assert.equal((await reconcile(attempt,'keep_notion')).status,409);
reset('timeout');await call();attempt=db.prepare('SELECT id FROM notion_writes').get().id;
db.prepare("UPDATE notion_writes SET created_at='2026-01-01T00:00:00.000Z'").run();remote.properties.Caption=rich('Edited');
const closed=await reconcile(attempt);assert.equal(closed.status,200);assert.equal((await closed.json()).notionWritten,false);assert.equal(writes,1);
assert.equal(db.prepare('SELECT state FROM notion_writes').get().state,'confirmed');
console.log('Reconciliation passed: admin role, quiet period, changed remote version, content mismatch, preserve Notion without retry, matching confirmation, closed-attempt rejection and unchanged local draft.');
db.close();delete globalThis.fixture;

// Exercise the real transport separately; never send a network request.
const transportSource=(await readFile(new URL('../lib/server/notion-write.ts',import.meta.url),'utf8')).replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?/gm,'');
const transportJS=ts.transpileModule("const env={NOTION_TOKEN:'fixture-token'}; class ApiError extends Error {}\n"+transportSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {writeNotionProperties}=await import('data:text/javascript;base64,'+Buffer.from(transportJS).toString('base64'));
const originalFetch=globalThis.fetch;let calls=0;
try {
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'https://api.notion.com/v1/pages/p');assert.equal(options.method,'PATCH');assert.equal(options.redirect,'manual');assert.equal(options.headers.Authorization,'Bearer fixture-token');assert.equal(options.headers['Notion-Version'],'2022-06-28');assert.deepEqual(JSON.parse(options.body),{properties:{Caption:{rich_text:[]}}});assert(options.signal);return new Response('{}',{status:400});};
 await assert.rejects(writeNotionProperties('p',{Caption:{rich_text:[]}}));assert.equal(calls,1);
 globalThis.fetch=async()=>{calls++;throw new Error('timeout');};await assert.rejects(writeNotionProperties('p',{}));assert.equal(calls,2);
}finally{globalThis.fetch=originalFetch;}
console.log('Notion transport passed: pinned API, scoped PATCH payload, auth, timeout signal, redirect refusal and no retries.');
