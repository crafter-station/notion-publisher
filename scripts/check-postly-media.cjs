require('ts-node/register');
const assert = require('node:assert/strict');
const { PostlyMediaService } = require('../src/services/postly-media.service');
(async () => {
 const original = global.fetch, calls = [], replies = [];
 const service = new PostlyMediaService('private-api-key');
 global.fetch = async (url, options) => { calls.push({url:String(url),...options}); const reply=replies.shift(); if(reply instanceof Error)throw reply; assert(reply,'Unexpected HTTP request'); return reply; };
 const json = data => Response.json({data});
 try {
  await assert.rejects(service.createSession({fileName:'test.mp4',size:0,type:'video/mp4',idempotencyKey:'media:1'}),e=>e.code==='invalid_input');
  assert.equal(calls.length,0);
  replies.push(json({upload_url:'https://storage.googleapis.com/upload?secret=signed',file_path:'private/test.mp4',size:3,type:'video/mp4'}));
  const session=await service.createSession({fileName:'test.mp4',size:3,type:'video/mp4',idempotencyKey:'media:1'});
  assert.equal(calls[0].headers['Idempotency-Key'],'media:1');
  assert.equal(calls[0].headers['X-API-Key'],'private-api-key');
  await assert.rejects(service.transfer(session,new Blob(['wrong'],{type:'video/mp4'})),e=>e.code==='invalid_input');
  await assert.rejects(service.transfer({...session,upload_url:'https://untrusted.example/upload'},new Blob(['abc'],{type:'video/mp4'})),e=>e.code==='invalid_input');
  assert.equal(calls.length,1);
  replies.push(new Response(null,{status:200}));
  await service.transfer(session,new Blob(['abc'],{type:'video/mp4'}));
  assert.deepEqual(calls[1].headers,{'Content-Type':'video/mp4'});
  assert.equal(calls[1].redirect,'error');
  assert.equal(calls.length,2,'Transfer must not complete the upload automatically');
  await assert.rejects(service.complete({filePath:session.file_path,idempotencyKey:'media:1:complete',allowPublicMedia:false}),e=>e.code==='invalid_input');
  assert.equal(calls.length,2);
  const published={url:'https://files.postly.ai/test.mp4',type:'video/mp4',size:3};
  replies.push(json(published));
  assert.deepEqual(await service.complete({filePath:session.file_path,idempotencyKey:'media:1:complete',allowPublicMedia:true}),published);
  assert.equal(calls[2].headers['Idempotency-Key'],'media:1:complete');
  replies.push(new Response(null,{status:202}));assert.deepEqual(await service.recover('media:1'),{state:'pending'});
  replies.push(json(published));assert.deepEqual(await service.recover('media:1'),{state:'completed',media:published});
  for(const failure of [new Error('secret signed URL'),new Response('sensitive body',{status:504}),new Response('invalid-json',{status:200})]){
   const before=calls.length;replies.push(failure);
   await assert.rejects(service.recover('media:1'),e=>e.code==='outcome_unknown'&&!/secret|sensitive/.test(e.message));
   assert.equal(calls.length,before+1,'No automatic retry');
  }
  assert(calls.every(c=>!c.url.endsWith('/posts')));
  console.log('Postly media checks passed: staged upload, explicit public completion, secret isolation, size/host validation, pending recovery, ambiguous failures, no retries or social publication.');
 } finally { global.fetch=original; }
})().catch(error=>{console.error(error);process.exitCode=1;});
