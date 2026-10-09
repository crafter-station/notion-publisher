import assert from 'node:assert/strict';
const base=process.env.OPEN_PUBLISHER_TEST_URL || 'http://localhost:3000';
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const headers={cookie:login.headers.get('set-cookie').split(';')[0],origin:base,'Content-Type':'application/json'};
const imported=await fetch(base+'/api/v1/notion/import',{method:'POST',headers,body:JSON.stringify({pageId:'3d6da243-5b46-8169-8dee-ebb512574f3b'})});assert([200,201].includes(imported.status));const {id}=await imported.json();
const url=base+'/api/v1/drafts/'+id+'/notion';
assert.equal((await fetch(url)).status,401);
const checked=await fetch(url,{headers});assert.equal(checked.status,200);const plan=await checked.json();assert.equal(plan.conflicts.length,0);
assert.equal((await fetch(url,{method:'POST',headers,body:JSON.stringify({revision:plan.revision,resolutions:{},remoteEditedAt:'stale'})})).status,409);
const submit=revision=>fetch(url,{method:'POST',headers,body:JSON.stringify({revision})});
assert.equal((await submit(0)).status,400);
const results=await Promise.all([submit(plan.revision),submit(plan.revision)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
const success=await results.find(r=>r.status===200).json();assert.equal(success.notionWritten,false);
const read=await fetch(base+'/api/v1/drafts/'+id,{headers});assert.equal((await read.json()).revision,plan.revision+1);
const issued=await fetch(base+'/api/v1/tokens',{method:'POST',headers,body:JSON.stringify({name:'Notion read-only scope fixture',access:'read'})});assert.equal(issued.status,201);const token=await issued.json();
try {assert.equal((await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token.token,'Content-Type':'application/json'},body:JSON.stringify({revision:success.revision})})).status,403);}finally{assert.equal((await fetch(base+'/api/v1/tokens/'+token.id,{method:'DELETE',headers})).status,200);}
console.log('Notion pull passed: live comparison, anonymous denial, revision validation, concurrent stale-write rejection and read-token mutation denial. No Notion writes.');
