import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {connectionOptions,request} from './open-publisher-client.mjs';

// Read-only diagnostics. Never report tokens, cookies, account identities or remote error bodies.
export async function doctor() {
 const report={ok:false,checks:[],limitations:['Does not verify publishing permissions or native client installation.']};
 const add=(stage,ok,details={})=>report.checks.push({stage,ok,...details});
 let options;let workspaceId;
 try {options=connectionOptions();add('configuration',true,{origin:options.base.origin,sitesCredentialConfigured:!!options.headers['OAI-Sites-Authorization']});}
 catch {add('configuration',false,{code:'configuration_required',message:'Set a valid HTTPS OPEN_PUBLISHER_URL and OPEN_PUBLISHER_TOKEN; loopback HTTP is supported for development.'});return report;}
 try {
  const session=await request('/api/v1/session');
  if(!session.workspaceId||!['administrator','editor','approver'].includes(session.role))throw new Error('Invalid session response');
  workspaceId=session.workspaceId;
  add('application_access',true,{role:session.role});
 } catch(error) {
  const text=String(error.message);
  const code=text.includes('sites_sign_in_required')?'sites_sign_in_required':text.includes('invalid_token')?'invalid_token':text.includes('membership_required')?'membership_required':'application_access_failed';
  add('application_access',false,{code,message:code==='sites_sign_in_required'?'Private Sites require a separate OPEN_PUBLISHER_SITES_TOKEN.':code==='invalid_token'?'The application token is expired, revoked or invalid.':'Check the site URL, network, credentials and team membership.'});return report;
 }
 try {
  const channels=await request('/api/v1/channels');
  if(!Array.isArray(channels.items))throw new Error('Invalid channel catalog');
  add('channel_catalog',true,{count:channels.items.length});
 }catch {add('channel_catalog',false,{code:'channel_catalog_failed'});}
 const remote=new Client({name:'open-publisher-doctor',version:'1.0.0'});
 try {
  const transport=new StreamableHTTPClientTransport(new URL('/api/v1/mcp',options.base),{requestInit:{headers:options.headers,redirect:'error'},fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.any([...(init?.signal?[init.signal]:[]),AbortSignal.timeout(15000)])})});
  await remote.connect(transport);
  const tools=[];let cursor;const seen=new Set();
  do {
   const page=await remote.listTools(cursor?{cursor}:undefined);
   tools.push(...page.tools.map(tool=>tool.name));
   cursor=page.nextCursor;
   if(cursor&&seen.has(cursor))throw new Error('Repeated cursor');
   if(cursor)seen.add(cursor);
   if(seen.size>20)throw new Error('Catalog page limit');
  }while(cursor);
  if(!tools.includes('publisher_session')||!tools.includes('publisher_list_channels'))throw new Error('Required tools missing');
  const result=await remote.callTool({name:'publisher_session',arguments:{}});
  if(result.isError)throw new Error('Session tool rejected');
  const block=result.content?.find(item=>item.type==='text');
  const session=block?JSON.parse(block.text):null;
  if(session?.workspaceId!==workspaceId)throw new Error('MCP workspace mismatch');
  add('mcp',true,{toolCount:tools.length,tools});
 }catch {add('mcp',false,{code:'mcp_connection_failed',message:'API access succeeded, but MCP initialization, discovery or the read-only session call failed.'});}
 finally {await remote.close().catch(()=>{});}
 report.ok=report.checks.every(check=>check.ok);
 return report;
}
