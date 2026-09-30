import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
let authorized=true;const calls=[];
const fixture={
  context: async()=>{if(!authorized)throw new fixture.ApiError(401,'unauthorized','Sign in');},
  ApiError: class extends Error {constructor(status,code,message){super(message);this.status=status;this.code=code;}},
  handle: async fn=>{try{return await fn();}catch(e){return Response.json({error:{code:e.code}},{status:e.status??500});}},
  respond: value=>Response.json(value),
  identityConnections: async provider=>{calls.push(provider);return {provider};},
};
for(const name of ['postly','postiz','typefully','reddit'])fixture[name+'Connections']=async()=>{calls.push(name);return {provider:name};};
globalThis.selectionFixture=fixture;
const source=(await readFile(new URL('../app/api/v1/connections/route.ts',import.meta.url),'utf8')).replace(/import[\s\S]*?from\s+['"][^'"]+['"];\s*/g,'');
const js=ts.transpileModule('const { '+Object.keys(fixture).join(',')+' }=globalThis.selectionFixture;\n'+source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
try {
  const {GET}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
  const query=provider=>GET(new Request('https://publisher.example/api/v1/connections'+(provider===undefined?'':'?provider='+encodeURIComponent(provider))));
  for(const name of ['postly','postiz','typefully','reddit','gumroad','luma','github','skool']) {
    calls.length=0;const response=await query(name);assert.equal(response.status,200);assert.deepEqual(calls,[name]);assert.deepEqual((await response.json()).items,[{provider:name}]);
  }
  for(const name of ['','__proto__','constructor','unknown']){calls.length=0;assert.equal((await query(name)).status,400);assert.equal(calls.length,0);}
  calls.length=0;assert.equal((await (await query()).json()).items.length,8);assert.equal(calls.length,8);
  authorized=false;calls.length=0;assert.equal((await query('postly')).status,401);assert.equal(calls.length,0);
  console.log('Provider selection verified: isolated reads, aggregate compatibility, allowlist and authentication before provider access.');
} finally {delete globalThis.selectionFixture;}
