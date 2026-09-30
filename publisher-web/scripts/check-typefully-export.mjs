import assert from 'node:assert/strict';
const base='http://localhost:3000';
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
assert(login.headers.get('set-cookie'),'Start the local development server before this check.');
const headers={cookie:login.headers.get('set-cookie').split(';')[0],origin:base,'Content-Type':'application/json'};
const title='[Private smoke] Hosted Typefully export';
const items=(await (await fetch(base+'/api/v1/drafts',{headers})).json()).items;
let draft=items.find(item=>item.title===title);
if(!draft){const response=await fetch(base+'/api/v1/drafts',{method:'POST',headers,body:JSON.stringify({title,body:'Private integration check. Not scheduled or published.',versions:{X:'Private integration check. Not scheduled or published.'}})});assert.equal(response.status,201);draft=await response.json();}
draft=await (await fetch(base+'/api/v1/drafts/'+draft.id,{headers})).json();
const url=base+'/api/v1/drafts/'+draft.id+'/typefully';
const input={revision:draft.revision,socialSetId:33552,channels:['X']};
const send=value=>fetch(url,{method:'POST',headers,body:JSON.stringify(value)});
assert.equal((await fetch(url)).status,401);
assert.equal((await send({...input,channels:['Substack']})).status,400);
assert.equal((await send({...input,revision:0})).status,400);
const issued=await fetch(base+'/api/v1/tokens',{method:'POST',headers,body:JSON.stringify({name:'Typefully read access test',access:'read'})});assert.equal(issued.status,201);const token=await issued.json();
try{assert.equal((await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token.token,'Content-Type':'application/json'},body:JSON.stringify(input)})).status,403);}finally{assert.equal((await fetch(base+'/api/v1/tokens/'+token.id,{method:'DELETE',headers})).status,200);}
if(process.argv.includes('--create-private')) {
  const results=await Promise.all([send(input),send(input)]);
  const parsed=await Promise.all(results.map(async response=>({status:response.status,body:await response.json()})));
  assert(parsed.some(item=>[200,201].includes(item.status)),JSON.stringify(parsed));
  assert(parsed.every(item=>[200,201,409].includes(item.status)),JSON.stringify(parsed));
  const retry=await send(input);assert.equal(retry.status,200);const reused=await retry.json();assert.equal(reused.reused,true);assert.equal(reused.receipt.status,'draft');
  const state=await (await fetch(url,{headers})).json();assert.equal(state.items.length,1);assert.equal(state.items[0].state,'created');assert.equal(state.items[0].receipt.id,reused.receipt.id);
  console.log(JSON.stringify({privateDraft:reused.receipt,concurrency:parsed.map(item=>item.status),nativeId:draft.id,result:'passed'}));
} else console.log('Typefully export boundaries passed. External creation skipped; use --create-private only with explicit private-draft authorization.');
