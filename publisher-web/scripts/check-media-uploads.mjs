import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
const sources = await Promise.all(['lib/server/private-media.ts','lib/server/media-uploads.ts'].map(f=>readFile(new URL('../'+f,import.meta.url),'utf8')));
const js=ts.transpileModule(sources.join('\n').replace(/^import .*;$/gm,''),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {claimMediaUpload,recordMediaSession,readMediaUpload,claimMediaPart,recordMediaPart,beginMediaCompletion,recordMediaCompletion}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const db=new DatabaseSync(':memory:');
for(const file of (await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()) db.exec(await readFile(new URL('../drizzle/'+file,import.meta.url),'utf8'));
const ctx = {
 workspaceId: 'a', userId: 'user',
 db: {
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
 },
};
try {
 db.prepare("INSERT INTO drafts(id,workspace_id,title,body,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").run('draft','a','fixture','','user','user','now','now');
 const input={draftId:'draft',idempotencyKey:'upload-one',fileName:'test.mp4',size:3,declaredType:'video/mp4'};
 await assert.rejects(claimMediaUpload({...ctx,workspaceId:'b'},input),/Draft not found/);
 const claims=await Promise.all([claimMediaUpload(ctx,input),claimMediaUpload(ctx,input)]);
 assert.equal(claims.filter(c=>c.claimed).length,1);assert.equal(claims[0].upload.id,claims[1].upload.id);
 const id=claims[0].upload.id;
 await assert.rejects(claimMediaUpload(ctx,{...input,size:4}),/different media/);
 await recordMediaSession(ctx,id,'storage-session');
 await assert.rejects(recordMediaSession(ctx,id,'replacement'));
 await assert.rejects(readMediaUpload({...ctx,workspaceId:'b'},id),/not found/);
 const sha='a'.repeat(64);
 assert.equal((await claimMediaPart(ctx,id,1,3,sha)).claimed,true);
 assert.equal((await claimMediaPart(ctx,id,1,3,sha)).claimed,false);
 await assert.rejects(claimMediaPart(ctx,id,1,3,'b'.repeat(64)),/different bytes/);
 await assert.rejects(beginMediaCompletion(ctx,id),/incomplete/);
 await assert.rejects(recordMediaPart({...ctx,workspaceId:'b'},id,1,sha,'etag'));
 await recordMediaPart(ctx,id,1,sha,'part-etag');
 await assert.rejects(recordMediaPart(ctx,id,1,sha,'replacement'));
 const completion=await beginMediaCompletion(ctx,id);assert.deepEqual(completion.parts.map(p=>({...p})),[{partNumber:1,etag:'part-etag'}]);
 await assert.rejects(beginMediaCompletion(ctx,id));
 await assert.rejects(claimMediaPart(ctx,id,1,3,sha),/upload state/);
 await recordMediaCompletion(ctx,id,'object-etag');
 const final=await readMediaUpload(ctx,id);assert.equal(final.state,'ready');assert.equal(final.etag,'object-etag');
 assert.equal(db.prepare('SELECT revision FROM drafts WHERE id=?').get('draft').revision,1,'Staging does not attach or modify the draft');
 console.log('Media ledger passed: migrations, single claim, workspace isolation, immutable part hashes/receipts, complete-part gate, completion lock and draft preservation.');
} finally { db.close(); }
