import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {doctor} from './open-publisher-doctor.mjs';
let mode='ok';const methods=[];const requests=[];
const server=createServer(async(req,res)=>{
 requests.push({url:req.url,headers:req.headers});
 if(mode==='gate'){res.writeHead(401,{'Content-Type':'text/html'});res.end('SECRET gate body');return;}
 res.setHeader('Content-Type','application/json');
 if(mode==='token'){res.writeHead(401);res.end(JSON.stringify({error:{code:'invalid_token',message:'SECRET token body'}}));return;}
 if(req.url==='/api/v1/session'){res.end(JSON.stringify({workspaceId:'private-workspace',role:'editor',email:'private@example.test'}));return;}
 if(req.url==='/api/v1/channels'){res.end(JSON.stringify({items:[{id:'X'}]}));return;}
 if(req.method!=='POST'){res.writeHead(405);res.end();return;}
 let raw='';for await(const chunk of req)raw+=chunk;const input=JSON.parse(raw);methods.push(input.method);
 if(input.id===undefined){res.writeHead(202);res.end();return;}
 let result;
 if(input.method==='initialize') result={protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1'}};
 else if(input.method==='tools/list') result={tools:mode==='missing'?[]:['publisher_session','publisher_list_channels'].map(name=>({name,inputSchema:{type:'object'}}))};
 else if(input.method==='tools/call'){assert.equal(input.params.name,'publisher_session');result={content:[{type:'text',text:JSON.stringify({workspaceId:'private-workspace',role:'editor'})}]};}
 else throw new Error('Unexpected method');
 res.end(JSON.stringify({jsonrpc:'2.0',id:input.id,result}));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
process.env.OPEN_PUBLISHER_URL='http://127.0.0.1:'+server.address().port;
process.env.OPEN_PUBLISHER_TOKEN='SECRET-app';process.env.OPEN_PUBLISHER_SITES_TOKEN='SECRET-gate';
try {
 let report=await doctor();assert(report.ok);assert.equal(report.checks.at(-1).toolCount,2);
 assert(methods.includes('initialize'));assert(methods.includes('tools/list'));assert(methods.includes('tools/call'));
 assert(requests.every(request=>request.headers.authorization==='Bearer SECRET-app'&&request.headers['oai-sites-authorization']==='Bearer SECRET-gate'));
 assert(!JSON.stringify(report).includes('SECRET'));assert(!JSON.stringify(report).includes('private-workspace'));assert(!JSON.stringify(report).includes('private@example'));
 mode='missing';report=await doctor();assert.equal(report.ok,false);assert.equal(report.checks.at(-1).code,'mcp_connection_failed');
 for(const [next,code] of [['gate','sites_sign_in_required'],['token','invalid_token']]){mode=next;const before=methods.length;report=await doctor();assert.equal(report.ok,false);assert.equal(report.checks.at(-1).code,code);assert.equal(methods.length,before);assert(!JSON.stringify(report).includes('SECRET'));}
 delete process.env.OPEN_PUBLISHER_TOKEN;const before=requests.length;report=await doctor();assert.equal(report.checks[0].code,'configuration_required');assert.equal(requests.length,before);
 console.log('Agent doctor passed: real MCP initialization/discovery/read-only session, auth headers, gate/token diagnosis, incomplete catalog, no secret/identity output and no writes.');
}finally{await new Promise(resolve=>server.close(resolve));}
