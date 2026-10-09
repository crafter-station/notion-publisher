import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const base=process.env.OPEN_PUBLISHER_TEST_URL || 'http://localhost:3000';
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
assert(login.headers.get('set-cookie'),'Start this Site dev server and set OPEN_PUBLISHER_TEST_URL to its local URL.');
const headers={cookie:login.headers.get('set-cookie').split(';')[0],origin:base,'Content-Type':'application/json'};
const response=await fetch(base+'/api/v1/tokens',{method:'POST',headers,body:JSON.stringify({name:'MCP integration test',access:'write'})});
assert.equal(response.status,201);const token=await response.json();
const client=new Client({name:'open-publisher-test',version:'1.0.0'});
try {
 await client.connect(new StdioClientTransport({command:process.execPath,args:['scripts/open-publisher-mcp.mjs'],env:{...process.env,OPEN_PUBLISHER_URL:base,OPEN_PUBLISHER_TOKEN:token.token}}));
 const list=await client.listTools();assert.equal(list.tools.length,21);
 const push=list.tools.find(t=>t.name==='publisher_push_notion');assert(push);assert(push.inputSchema.required.includes('remoteEditedAt'));
 const missing=await client.callTool({name:'publisher_push_notion',arguments:{id:'nonexistent-stdio-fixture',revision:1,remoteEditedAt:'2026-09-14T00:00:00.000Z'}});assert.equal(missing.isError,true);assert.equal(JSON.parse(missing.content[0].text).error.code,'notion_link_missing');
 const connections=await client.callTool({name:'publisher_list_connections',arguments:{}});assert(!connections.isError);assert(Array.isArray(JSON.parse(connections.content[0].text).items));
 const create=await client.callTool({name:'publisher_create_draft',arguments:{title:'MCP test fixture',body:'Agent-created content',channelSettings:{reddit_subreddit:'test',reddit_kind:'self'},versions:{X:'Agent channel text'}}});
 assert(!create.isError);const record=JSON.parse(create.content[0].text);
 const get=await client.callTool({name:'publisher_get_draft',arguments:{id:record.id}});assert(!get.isError);assert.equal(JSON.parse(get.content[0].text).body,'Agent-created content');assert.deepEqual(JSON.parse(get.content[0].text).channelSettings,{reddit_subreddit:'test',reddit_kind:'self'});
 const denied=await client.callTool({name:'publisher_update_draft',arguments:{id:record.id,revision:99,title:'Conflict',body:'Do not overwrite',versions:{}}});assert.equal(denied.isError,true);
 console.log('MCP stdio checks passed: tool discovery, authenticated create/read and actionable revision conflict.');
} finally {
 await client.close();
 assert.equal((await fetch(base+'/api/v1/tokens/'+token.id,{method:'DELETE',headers})).status,200);
}
