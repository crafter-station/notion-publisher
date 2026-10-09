import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL||'http://localhost:3000';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('This fixture is local-only');
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=login.headers.get('set-cookie')?.split(';')[0];
assert(cookie,'Local sign-in cookie missing');
const headers={cookie,origin:base,'Content-Type':'application/json'};
const anonymous=await fetch(base+'/api/v1/drafts');assert.equal(anonymous.status,401);
const session=await fetch(base+'/api/v1/session',{headers});assert.equal(session.status,200,await session.text());
const input={title:'Integration test '+new Date().toISOString(),body:'Shared content',versions:{LinkedIn:'Channel version'}};
const create=await fetch(base+'/api/v1/drafts',{method:'POST',headers,body:JSON.stringify(input)});
assert.equal(create.status,201);const record=await create.json();
const read=await fetch(base+'/api/v1/drafts/'+record.id,{headers});const stored=await read.json();assert.equal(stored.body,input.body);assert.deepEqual(stored.versions,input.versions);
const patch=()=>fetch(base+'/api/v1/drafts/'+record.id,{method:'PATCH',headers,body:JSON.stringify({...input,body:'Updated',revision:1})});
assert.equal((await patch()).status,200);assert.equal((await patch()).status,409);
const csrf=await fetch(base+'/api/v1/drafts',{method:'POST',headers:{...headers,origin:'https://other.example'},body:JSON.stringify(input)});assert.equal(csrf.status,403);
const invalid=await fetch(base+'/api/v1/drafts',{method:'POST',headers,body:JSON.stringify({...input,versions:{X:42}})});assert.equal(invalid.status,400);
console.log('Draft API checks passed: authenticated persistence, overrides, version conflict, CSRF and input validation.');
console.log('Local fixture retained:',record.id);
const review=async(action,revision)=>fetch(base+'/api/v1/drafts/'+record.id+'/review',{method:'POST',headers,body:JSON.stringify({action,revision})});
assert.equal((await review('approve',2)).status,409,'Cannot approve without submission');
assert.equal((await review('submit',2)).status,200);
assert.equal((await review('approve',3)).status,200);
assert.equal((await review('approve',3)).status,409,'Cannot repeat stale approval');
console.log('Review transitions passed: submit, approve, reject invalid/stale transitions.');
const makeToken=async access=>{const r=await fetch(base+'/api/v1/tokens',{method:'POST',headers,body:JSON.stringify({name:'Local integration test',access})});assert.equal(r.status,201);return r.json();};
const readToken=await makeToken('read'),writeToken=await makeToken('write');
try {
 const readHeaders={Authorization:'Bearer '+readToken.token,'Content-Type':'application/json'};
 assert.equal((await fetch(base+'/api/v1/drafts',{headers:readHeaders})).status,200);
 assert.equal((await fetch(base+'/api/v1/drafts',{method:'POST',headers:readHeaders,body:JSON.stringify(input)})).status,403);
 const agentHeaders={Authorization:'Bearer '+writeToken.token,'Content-Type':'application/json'};
 assert.equal((await fetch(base+'/api/v1/drafts',{method:'POST',headers:agentHeaders,body:JSON.stringify({...input,title:'Agent draft fixture'})})).status,201);
 assert.equal((await fetch(base+'/api/v1/tokens',{headers:agentHeaders})).status,403);
 assert.equal((await fetch(base+'/api/v1/team',{headers:agentHeaders})).status,403);
 const tokens=await (await fetch(base+'/api/v1/tokens',{headers})).json();
 assert(tokens.items.every(t=>!('token' in t)&&!('token_hash' in t)));
} finally {
 for(const t of [readToken,writeToken])assert.equal((await fetch(base+'/api/v1/tokens/'+t.id,{method:'DELETE',headers})).status,200);
}
assert.equal((await fetch(base+'/api/v1/drafts',{headers:{Authorization:'Bearer '+writeToken.token}})).status,401);
console.log('Agent credential checks passed: read/write scopes, human-only administration, hash privacy and revocation.');

const oversized=await fetch(base+'/api/v1/drafts',{method:'POST',headers,body:JSON.stringify({...input,body:'é'.repeat(510000)})});
assert.equal(oversized.status,413,'Request size limit applies to bytes before decoding');
console.log('Bounded request body check passed.');
