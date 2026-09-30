import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../lib/typefully-payload.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {typefullyPayload:build,typefullyReceipt:receipt}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const content={title:'Private',body:'Shared',versions:{X:'First\n\n\n\nSecond',Threads:'Custom'}};
const payload=build(content,['X','Threads','LinkedIn'],33552);
assert.equal(payload.share,false);assert(!('publish_at' in payload));
assert.deepEqual(payload.platforms.x.posts,[{text:'First'},{text:'Second'}]);
assert.equal(payload.platforms.threads.posts[0].text,'Custom');assert.equal(payload.platforms.linkedin.posts[0].text,'Shared');
for(const channels of [[],['Substack'],['__proto__'],null]) assert.throws(()=>build(content,channels,33552));
assert.throws(()=>build({...content,versions:{X:'First\n\n\n\n'}},['X'],33552));
assert.throws(()=>build(content,['X'],0));
assert.throws(()=>build({...content,versions:{X:''}},['X'],33552));
const valid={id:1,status:'draft',private_url:'https://typefully.com/?d=1',share_url:null,published_at:null};
assert.equal(receipt(valid).id,1);
for(const patch of [{status:'published'},{share_url:'https://typefully.com/shared'},{published_at:'2026-01-01'},{private_url:'https://evil.example/'},{id:-1}]) assert.throws(()=>receipt({...valid,...patch}));
console.log('Typefully payload passed: selected channels, thread order, independent text, empty-post rejection, private-only payload and receipt validation.');

assert.throws(()=>build({...content,mediaIds:['private-file']},['X'],33552),/archivos adjuntos/);

const pinnedContent={title:'Pinned',body:'Test',versions:{},publicationSet:{accounts:[{provider:'typefully',accountId:'1:x',sourceGroupId:'1'}]}};
assert.equal(build(pinnedContent,['X'],1).social_set_id,1);
assert.throws(()=>build(pinnedContent,['LinkedIn'],1));
assert.throws(()=>build(pinnedContent,['X'],2));
assert.throws(()=>build({...pinnedContent,publicationSet:{accounts:[]}},['X'],1));
