import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const base='http://localhost:3000', workspace='crafter-station';
const run=sql=>execFileSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','wrangler.local.json','--command',sql],{stdio:'pipe'});
const people=['editor','approver'].map(role=>({role,id:randomUUID(),tokenId:randomUUID(),token:'op_'+randomBytes(32).toString('hex')}));
for(const p of people)p.email=p.id+'@local-test.invalid';
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const browser={cookie:login.headers.get('set-cookie').split(';')[0],origin:base,'Content-Type':'application/json'};
try {
 for(const p of people){const hash=createHash('sha256').update(p.token).digest('hex');run(`INSERT INTO members VALUES ('${workspace}','${p.id}','${p.email}','${p.role}'); INSERT INTO api_tokens (id,token_hash,workspace_id,user_id,name,access,created_at,expires_at) VALUES ('${p.tokenId}','${hash}','${workspace}','${p.id}','Local role fixture','write','${new Date().toISOString()}','${new Date(Date.now()+3600000).toISOString()}');`);}
 const [editor,approver]=people;
 const headers=p=>({Authorization:'Bearer '+p.token,'Content-Type':'application/json'});
 const created=await fetch(base+'/api/v1/drafts',{method:'POST',headers:headers(editor),body:JSON.stringify({title:'Role test fixture',body:'Review permission check',versions:{}})});assert.equal(created.status,201);const draft=await created.json();
 const review=(p,action,revision)=>fetch(base+'/api/v1/drafts/'+draft.id+'/review',{method:'POST',headers:headers(p),body:JSON.stringify({action,revision})});
 assert.equal((await review(editor,'submit',1)).status,200);
 assert.equal((await review(editor,'approve',2)).status,403);
 assert.equal((await review(approver,'approve',2)).status,200);
 const removed=await fetch(base+'/api/v1/team',{method:'DELETE',headers:browser,body:JSON.stringify({email:editor.email})});assert.equal(removed.status,200);
 assert.equal((await fetch(base+'/api/v1/session',{headers:headers(editor)})).status,401);
 run(`INSERT INTO members VALUES ('${workspace}','${editor.id}','${editor.email}','editor');`);
 assert.equal((await fetch(base+'/api/v1/session',{headers:headers(editor)})).status,401,'Rejoining must not reactivate an old credential');
 console.log('Team role checks passed: editor submission, editor approval denied, approver approval, removal and permanent token revocation.');
} finally {
 for(const p of people)run(`DELETE FROM api_tokens WHERE id='${p.tokenId}'; DELETE FROM members WHERE workspace_id='${workspace}' AND user_id='${p.id}';`);
}
