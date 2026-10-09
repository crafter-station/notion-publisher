import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const base = process.env.OPEN_PUBLISHER_TEST_URL || 'http://localhost:3000';
const login = await fetch(base + '/signin-with-chatgpt?return_to=/', { redirect: 'manual' });
const headers = { cookie: login.headers.get('set-cookie').split(';')[0], origin: base, 'Content-Type': 'application/json' };
assert.equal((await fetch(base + '/api/v1/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: '{}' })).status, 401);
// Isolate deliberately rejected requests: the local dev transport can leave
// their request body on a reused HTTP/1 connection and return an empty 400 later.
const tokens=[];
try {
 for (const access of ['read', 'write']) {
  const issued=await fetch(base+'/api/v1/tokens',{method:'POST',headers,body:JSON.stringify({name:'HTTP MCP fixture',access})});assert.equal(issued.status,201);const token=await issued.json();tokens.push(token);
  const client=new Client({name:'open-publisher-http-test',version:'1.0.0'});
  try {
   await client.connect(new StreamableHTTPClientTransport(new URL(base+'/api/v1/mcp'),{requestInit:{headers:{Authorization:'Bearer '+token.token}}}));
   const tools=await client.listTools();assert.equal(tools.tools.length,21);
   const catalog=await client.callTool({name:'publisher_list_channels',arguments:{}});assert(!catalog.isError);assert.equal(JSON.parse(catalog.content[0].text).items.length,48);
   const pushTool=tools.tools.find(t=>t.name==='publisher_push_notion');assert(pushTool);assert.equal(pushTool.annotations.readOnlyHint,false);assert.equal(pushTool.annotations.openWorldHint,true);assert(pushTool.inputSchema.required.includes('remoteEditedAt'));
   const missing=await client.callTool({name:'publisher_push_notion',arguments:{id:'nonexistent-mcp-fixture',revision:1,remoteEditedAt:'2026-09-14T00:00:00.000Z'}});assert.equal(missing.isError,true);assert.equal(JSON.parse(missing.content[0].text).error.code,access==='read'?'token_read_only':'notion_link_missing');
   const recoveryTool=tools.tools.find(t=>t.name==='publisher_reconcile_notion');assert(recoveryTool);assert.equal(recoveryTool.annotations.readOnlyHint,false);
   const recovery=await client.callTool({name:'publisher_reconcile_notion',arguments:{id:'nonexistent-mcp-fixture',attemptId:'00000000-0000-4000-8000-000000000000',remoteEditedAt:'2026-09-14T00:00:00.000Z',action:'confirm'}});assert.equal(recovery.isError,true);assert.equal(JSON.parse(recovery.content[0].text).error.code,access==='read'?'token_read_only':'notion_attempt_missing');
   const sets=await client.callTool({name:'publisher_list_sets',arguments:{}});assert(!sets.isError);
   const setInput={id:crypto.randomUUID(),name:'Private MCP set fixture',accounts:[{provider:'typefully',accountId:'fixture-only'}]};
   const newSet=await client.callTool({name:'publisher_create_set',arguments:setInput});
   if(access==='read'){assert(newSet.isError);assert.equal(JSON.parse(newSet.content[0].text).error.code,'token_read_only');}
   else {assert(!newSet.isError);const replay=await client.callTool({name:'publisher_create_set',arguments:setInput});assert(!replay.isError);assert.equal(JSON.parse(replay.content[0].text).revision,1);const readSet=await client.callTool({name:'publisher_get_set',arguments:{id:setInput.id}});assert(!readSet.isError);const verified=await client.callTool({name:'publisher_verify_set',arguments:{id:setInput.id}});assert(!verified.isError);assert.equal(JSON.parse(verified.content[0].text).publicationAuthorized,false);const change=await client.callTool({name:'publisher_update_set',arguments:{...setInput,revision:1,name:'Updated MCP set fixture'}});assert(!change.isError);assert.equal(JSON.parse(change.content[0].text).revision,2);}
   const session=await client.callTool({name:'publisher_session',arguments:{}});assert(!session.isError);
   const created=await client.callTool({name:'publisher_create_draft',arguments:{title:'HTTP MCP test fixture',body:'Protocol test',publicationSet:{id:setInput.id,revision:2},channelSettings:{reddit_subreddit:'test',reddit_kind:'self'},versions:{X:'HTTP draft'}}});
   if(access==='read'){assert.equal(created.isError,true);assert.equal(JSON.parse(created.content[0].text).error.code,'token_read_only');}
   else {
    assert(!created.isError);const draft=JSON.parse(created.content[0].text);
    const fetched=await client.callTool({name:'publisher_get_draft',arguments:{id:draft.id}});assert(!fetched.isError);assert.equal(JSON.parse(fetched.content[0].text).body,'Protocol test');assert.equal(JSON.parse(fetched.content[0].text).publicationSet.id,setInput.id);assert.equal(JSON.parse(fetched.content[0].text).publicationSet.revision,2);assert.deepEqual(JSON.parse(fetched.content[0].text).channelSettings,{reddit_subreddit:'test',reddit_kind:'self'});
    const stale=await client.callTool({name:'publisher_update_draft',arguments:{id:draft.id,revision:900,title:'Stale',body:'Stale',versions:{}}});assert.equal(stale.isError,true);assert.equal(JSON.parse(stale.content[0].text).error.code,'revision_conflict');
   }
  } finally { await client.close(); }
 }
 const cross=await fetch(base+'/api/v1/mcp',{method:'POST',headers:{Authorization:'Bearer '+tokens[1].token,Origin:'https://untrusted.example','Content-Type':'application/json',Connection:'close'},body:'{}'});assert.equal(cross.status,403);
 console.log('HTTP MCP passed: initialization, twenty-one tools, read/write scopes, authenticated persistence, revision conflict and Origin rejection.');
} finally {for(const t of tokens){const cleanup=await fetch(base+'/api/v1/tokens/'+t.id,{method:'DELETE',headers:{cookie:headers.cookie,origin:base}});const receipt=await cleanup.text();assert.equal(cleanup.status,200,receipt.slice(0,300));}}
