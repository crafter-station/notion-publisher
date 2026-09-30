import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
const read=f=>readFile(new URL('../'+f,import.meta.url),'utf8');
let source=(await Promise.all(['lib/channel-settings.ts','lib/server/drafts.ts'].map(read))).join('\n');
source+='\n'+(await read('app/api/v1/drafts/route.ts')).replace('export const dynamic','const listDynamic').replace('function GET(', 'function listGET(');
source+='\n'+await read('app/api/v1/drafts/[id]/route.ts');
source=source.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?/gm,'');
source=`class ApiError extends Error {constructor(public status:number,public code:string,message:string){super(message)}}
const context=async()=>globalThis.attachmentContext;
const respond=(body:any,status=200)=>Response.json(body,{status});
const handle=async(fn:any)=>{try{return await fn()}catch(e){return respond({code:e.code},e.status||500)}};
`+source;
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {POST,PATCH,GET}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const db=new DatabaseSync(':memory:');
for(const f of (await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())db.exec(await read('drizzle/'+f));
globalThis.attachmentContext={workspaceId:'w',userId:'u',role:'editor',db:{
 prepare(sql){return {bind(...args){return {
 first:async()=>db.prepare(sql).get(...args)||null,
 all:async()=>({results:db.prepare(sql).all(...args)}),
 run:async()=>({meta:{changes:db.prepare(sql).run(...args).changes}}),
 };}};},
}};
const request=(body,method='PATCH')=>new Request('https://example.test/api/v1/drafts',{method,...(method === 'GET' ? {} : {body:JSON.stringify(body)})});
const content={title:'Media test',body:'caption',versions:{}};
try{
 assert.equal((await POST(request({...content,mediaIds:['not-ready']},'POST'))).status,400);
 const created=await POST(request(content,'POST'));assert.equal(created.status,201);const {id}=await created.json();const params={params:Promise.resolve({id})};
 for(const [asset,state,workspace,draft] of [['one','ready','w',id],['two','ready','w',id],['pending','uploading','w',id],['foreign','ready','other',id]]){
 db.prepare('INSERT INTO media_uploads(id,workspace_id,draft_id,idempotency_key,file_name,size,declared_type,state,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(asset,workspace,draft,asset,'test.mp4',3,'video/mp4',state,'u','now');
 }
 const save=(mediaIds,revision=1)=>PATCH(request({...content,revision,mediaIds}),params);
 assert.equal((await save(['pending'])).status,409);assert.equal((await save(['foreign'])).status,409);assert.equal((await save(['one','one'])).status,400);
 globalThis.attachmentContext.role='approver';assert.equal((await save(['one'])).status,403);globalThis.attachmentContext.role='editor';
 db.prepare("UPDATE drafts SET status='approved' WHERE id=?").run(id);
 assert.equal((await save(['two','one'])).status,200);
 const load=async()=> (await GET(new Request('https://example.test'),params)).json();
 const row=await load();assert.equal(row.status,'draft');assert.equal(row.revision,2);assert.deepEqual(row.mediaIds,['two','one']);assert(!('media_ids' in row));
 assert.equal((await save([],1)).status,409);assert.deepEqual((await load()).mediaIds,['two','one']);
 assert.equal((await PATCH(request({...content,revision:2}),params)).status,200);assert.deepEqual((await load()).mediaIds,['two','one'],'Legacy text updates preserve media');
 assert.equal((await save([],3)).status,200);assert.deepEqual((await load()).mediaIds,[]);
 assert.equal(db.prepare("SELECT state FROM media_uploads WHERE id='one'").get().state,'ready','Detaching does not delete originals');

 const setId='33333333-3333-4333-8333-333333333333';
 const originalAccounts=[{provider:'typefully',accountId:'1:x',sourceGroupId:'1'}];
 db.prepare('INSERT INTO publication_sets VALUES(?,?,?,?,?,?,?,?,?)').run(setId,'w','Brand',JSON.stringify(originalAccounts),1,'u','u','now','now');
 const selection={id:setId,revision:1};
 const attach=(publicationSet,revision=4)=>PATCH(request({...content,revision,publicationSet}),params);
 globalThis.attachmentContext.role='approver'; assert.equal((await attach(selection)).status,403); globalThis.attachmentContext.role='editor';
 assert.equal((await attach({...selection,revision:2})).status,409);
 globalThis.attachmentContext.workspaceId='other'; assert.equal((await POST(request({...content,publicationSet:selection},'POST'))).status,404); globalThis.attachmentContext.workspaceId='w';
 db.prepare("UPDATE drafts SET status='approved' WHERE id=?").run(id);
 assert.equal((await attach({...selection,accounts:[{provider:'evil',accountId:'injected'}]})).status,200);
 const pinned=await load(); assert.equal(pinned.status,'draft'); assert.equal(pinned.revision,5); assert.deepEqual(pinned.publicationSet.accounts,originalAccounts);
 db.prepare("UPDATE publication_sets SET revision=2,accounts='[]' WHERE id=?").run(setId);
 assert.equal((await attach(selection,5)).status,200); assert.deepEqual((await load()).publicationSet.accounts,originalAccounts);
 assert.equal((await PATCH(request({...content,revision:6}),params)).status,200); assert.equal((await load()).publicationSet.revision,1);
 assert.equal((await attach({...selection,revision:2},7)).status,200); assert.deepEqual((await load()).publicationSet.accounts,[]);
 assert.equal((await attach(null,7)).status,409); assert.equal((await load()).publicationSet.revision,2);
 assert.equal((await attach(null,8)).status,200); assert.equal((await load()).publicationSet,null);
 const withSet=await POST(request({...content,publicationSet:{...selection,revision:2}},'POST')); assert.equal(withSet.status,201);
 console.log('Publication set attachment passed: workspace isolation, roles, stale set revision, server-owned snapshot, approved reset, no silent retarget, preserve omitted selection and explicit refresh/detach.');
 console.log('Media attachments passed: migration, actual draft routes, readiness/ownership, role, ordering, approval invalidation, revision conflicts, legacy preservation and detach.');
}finally{db.close();delete globalThis.attachmentContext;}
