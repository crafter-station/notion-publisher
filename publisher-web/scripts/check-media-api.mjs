import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { Miniflare,convertV4MiniflareOptions } from 'miniflare';
import ts from 'typescript';
const read=f=>readFile(new URL('../'+f,import.meta.url),'utf8');
const files=['lib/server/context.ts','lib/channel-settings.ts','lib/server/drafts.ts','lib/server/private-media.ts','lib/server/media-uploads.ts','lib/server/media-api.ts'];
let source=(await Promise.all(files.map(read))).join('\n').replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?/gm,'').replaceAll('import.meta.env.DEV','false');
source='const env=globalThis.mediaEnv; const getChatGPTUser=async()=>globalThis.mediaUser;\n'+source;
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const db=new DatabaseSync(':memory:');
for(const f of (await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())db.exec(await read('drizzle/'+f));
const binding = {
 prepare(sql) {
  return {
   bind(...args) {
    return {
     first: async () => db.prepare(sql).get(...args) || null,
     all: async () => ({ results: db.prepare(sql).all(...args) }),
     run: async () => ({ meta: { changes: db.prepare(sql).run(...args).changes } }),
    };
   },
  };
 },
};
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("Not exposed",{status:404})}}',r2Buckets:['MEDIA']}));
try{
 globalThis.mediaEnv={DB:binding,BUCKET:await mf.getR2Bucket('MEDIA')};
 globalThis.mediaUser=null;
 const api=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
 const base='https://publisher.example';
 const req=(path,method='GET',body,token)=>new Request(base+path,{method,headers:{Origin:base,...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:typeof body==='string'||body instanceof Uint8Array?body:JSON.stringify(body)})});
 const run=fn=>api.handle(fn);
 const input={draftId:'draft',idempotencyKey:'media-api-test',fileName:'clip.mp4',size:3,declaredType:'video/mp4'};
 assert.equal((await run(()=>api.createMedia(req('/api/v1/media','POST',input)))).status,401);
 for(const [id,role] of [['editor','editor'],['approver','approver']])db.prepare('INSERT INTO members VALUES(?,?,?,?)').run('crafter-station',id,id+'@example.test',role);
 db.prepare("INSERT INTO drafts(id,workspace_id,title,body,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").run('draft','crafter-station','fixture','','editor','editor','now','now');
 globalThis.mediaUser={userId:'approver',email:'approver@example.test'};
 assert.equal((await run(()=>api.createMedia(req('/api/v1/media','POST',input)))).status,403);
 globalThis.mediaUser={userId:'editor',email:'editor@example.test'};
 const cross=new Request(base+'/api/v1/media',{method:'POST',headers:{Origin:'https://evil.example'},body:JSON.stringify(input)});
 assert.equal((await run(()=>api.createMedia(cross))).status,403);
 const created=await run(()=>api.createMedia(req('/api/v1/media','POST',input)));assert.equal(created.status,201);const item=await created.json();
 assert.equal(item.state,'uploading');assert(!('uploadId' in item));
 const duplicate=await run(()=>api.createMedia(req('/api/v1/media','POST',input)));assert.equal((await duplicate.json()).id,item.id);
 const path='/api/v1/media/'+item.id;
 assert.equal((await run(()=>api.finishMedia(req(path,'POST'),item.id))).status,409);
 assert.equal((await run(()=>api.uploadMediaPart(req(path+'?part=1','PUT','abcd'),item.id))).status,413);
 assert.equal((await run(()=>api.uploadMediaPart(req(path+'?part=1','PUT','ab'),item.id))).status,400);
 assert.equal((await run(()=>api.uploadMediaPart(req(path+'?part=1','PUT','abc'),item.id))).status,200);
 assert.equal((await run(()=>api.uploadMediaPart(req(path+'?part=1','PUT','abc'),item.id))).status,200);
 assert.equal((await run(()=>api.uploadMediaPart(req(path+'?part=1','PUT','xyz'),item.id))).status,409);
 assert.equal((await (await run(()=>api.finishMedia(req(path,'POST'),item.id))).json()).state,'ready');
 assert.equal((await (await run(()=>api.finishMedia(req(path,'POST'),item.id))).json()).state,'ready');
 const downloaded=await run(()=>api.inspectMedia(req(path+'?download=1'),item.id));
 assert.equal(downloaded.status,200);assert.equal(await downloaded.text(),'abc');
 assert.equal(downloaded.headers.get('Content-Type'),'application/octet-stream');
 assert.equal(downloaded.headers.get('Cache-Control'),'private, no-store');
 assert(downloaded.headers.get('Content-Disposition').startsWith('attachment;'));
 assert.equal(downloaded.headers.get('X-Content-Type-Options'),'nosniff');
 const token='op_'+'a'.repeat(64);db.prepare('INSERT INTO api_tokens (id,token_hash,workspace_id,user_id,name,access,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)').run('token',await api.hashToken(token),'crafter-station','editor','test','read','now','2099-01-01');
 globalThis.mediaUser=null;
 assert.equal((await run(()=>api.inspectMedia(req(path,'GET',undefined,token),item.id))).status,200);
 assert.equal((await run(()=>api.finishMedia(req(path,'POST',undefined,token),item.id))).status,403);
 db.prepare('UPDATE api_tokens SET workspace_id=? WHERE id=?').run('other','token');
 db.prepare('INSERT INTO members VALUES(?,?,?,?)').run('other','editor','editor@example.test','editor');
 assert.equal((await run(()=>api.inspectMedia(req(path,'GET',undefined,token),item.id))).status,404);
 console.log('Media API passed against local R2 and SQLite: real auth logic, read token, roles, origin, private claims, bounded body, idempotent upload, immutable bytes, completion and workspace isolation.');
}finally{delete globalThis.mediaEnv;delete globalThis.mediaUser;db.close();await mf.dispose();}
