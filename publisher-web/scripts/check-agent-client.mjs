import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {request} from './open-publisher-client.mjs';
const requests=[];
const server=createServer((req,res)=>{requests.push(req.headers);if(req.url.endsWith('/html')){res.writeHead(401,{'Content-Type':'text/html'});res.end('Sign in required');}else if(req.url.endsWith('/invalid')){res.writeHead(200);res.end('not json');}else if(req.url.endsWith('/redirect')){res.writeHead(302,{Location:'/api/v1/session'});res.end();}else{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true}));}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
process.env.OPEN_PUBLISHER_URL='http://127.0.0.1:'+server.address().port;
process.env.OPEN_PUBLISHER_TOKEN='test-app-token';process.env.OPEN_PUBLISHER_SITES_TOKEN='test-site-token';
try {
 assert.equal((await request('/api/v1/session')).ok,true);
 assert.equal(requests[0].authorization,'Bearer test-app-token');
 assert.equal(requests[0]['oai-sites-authorization'],'Bearer test-site-token');
 await assert.rejects(request('https://other.example/api/v1/session'),/must target/);
 assert.equal(requests.length,1);
 await assert.rejects(request('/api/v1/html'),/sites_sign_in_required/);
 await assert.rejects(request('/api/v1/invalid'),/invalid_response/);
 const before=requests.length;await assert.rejects(request('/api/v1/redirect'));assert.equal(requests.length,before+1);
 delete process.env.OPEN_PUBLISHER_SITES_TOKEN;await request('/api/v1/session');assert.equal(requests.at(-1)['oai-sites-authorization'],undefined);
 console.log('Agent client passed: separate auth headers, same-origin restriction, redirect refusal and non-JSON errors.');
}finally{await new Promise(resolve=>server.close(resolve));}
