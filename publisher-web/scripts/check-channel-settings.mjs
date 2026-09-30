import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
let source=(await Promise.all(['lib/channel-settings.ts','lib/postiz-versions.ts','lib/notion-content.ts','lib/notion-write-plan.ts','lib/server/drafts.ts'].map(read))).join('\n');
source+='\n'+(await read('app/api/v1/drafts/route.ts')).replace('export const dynamic', 'const listDynamic').replace('function GET(', 'function listGET(');
source+='\n'+(await read('app/api/v1/drafts/[id]/route.ts')).replace('export const dynamic', 'const itemDynamic');
source=source.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?/gm,'');
source=`class ApiError extends Error {constructor(public status:number,public code:string,message:string){super(message)}}
const context=async()=>({db:globalThis.settingsDB,workspaceId:'w',userId:'u'});
const respond=(body:any,status=200)=>Response.json(body,{status});
const handle=async(fn:any)=>{try{return await fn()}catch(e){return respond({error:e.message},e.status||500)}};
`+source;
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {parseChannelSettings,notionContent,notionSnapshot,notionBaseline,mergeNotionContent:merge,resolveNotionConflicts:resolve,notionWritePlan:plan,POST,PATCH,GET}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
assert.throws(()=>parseChannelSettings({reddit_kind:'video'}));
assert.throws(()=>parseChannelSettings({reddit_link:'javascript:alert(1)'}));
assert.throws(()=>parseChannelSettings({unrecognized:'value'}));
assert.deepEqual(parseChannelSettings({reddit_title:''}),{});
const rich=s=>({type:'rich_text',rich_text:s?[{plain_text:s}]:[]});
const props={Name:{type:'title',title:[{plain_text:'Title'}]},Caption:rich('Body'),'Reddit Title':rich('Reddit title'),'Reddit Subreddit':rich('test'),'Reddit Flair ID':rich(''), 'Reddit Post Type':{type:'select',select:{name:'self'}},'Reddit Link URL':{type:'url',url:null}};
const baseline=notionContent(props);
assert.equal(baseline.channelSettings.reddit_kind,'self');
assert.deepEqual(notionBaseline(notionSnapshot(props)),baseline);
const old={title:baseline.title,body:baseline.body,versions:baseline.versions};
assert.equal(merge(old,old,baseline).content.channelSettings.reddit_kind,'self');
const local=structuredClone(baseline),remote=structuredClone(baseline);
local.channelSettings.reddit_title='Local title';remote.channelSettings.reddit_kind='link';
assert.equal(merge(baseline,local,remote).conflicts.length,0);
remote.channelSettings.reddit_title='Other title';
const conflict=merge(baseline,local,remote);
assert.equal(conflict.conflicts[0].field,'channelSettings.reddit_title');
assert.equal(resolve(conflict,{'channelSettings.reddit_title':'notion'}).content.channelSettings.reddit_title,'Other title');
const desired={...baseline,channelSettings:{reddit_kind:'link',reddit_link:'https://example.com'}};
const patch=plan(props,desired).properties;
assert.deepEqual(patch['Reddit Post Type'],{select:{name:'link'}});
assert.deepEqual(patch['Reddit Link URL'],{url:'https://example.com'});
assert.deepEqual(patch['Reddit Title'],{rich_text:[]});
assert.deepEqual(plan(props,{...baseline,channelSettings:{}}).properties['Reddit Post Type'],{select:null});
const db=new DatabaseSync(':memory:');
for(const file of (await readdir(new URL('../drizzle/',import.meta.url))).filter(x=>x.endsWith('.sql')).sort())db.exec(await read('drizzle/'+file));
globalThis.settingsDB = {
  prepare(sql) {
    return {
      bind(...args) {
        return {
          first: async () => db.prepare(sql).get(...args),
          all: async () => ({ results: db.prepare(sql).all(...args) }),
          run: async () => ({ meta: { changes: db.prepare(sql).run(...args).changes } }),
        };
      },
    };
  },
};
const request=(body,method='POST')=>new Request('https://example.test/api/v1/drafts',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const created=await POST(request(baseline));assert.equal(created.status,201);const record=await created.json();const params={params:Promise.resolve({id:record.id})};
let loaded=await (await GET(new Request('https://example.test'),params)).json();assert.deepEqual(loaded.channelSettings,baseline.channelSettings);
const legacy={title:'Legacy client',body:'Body',versions:{},revision:1};
assert.equal((await PATCH(request(legacy,'PATCH'),params)).status,200);
loaded=await (await GET(new Request('https://example.test'),params)).json();assert.deepEqual(loaded.channelSettings,baseline.channelSettings);
assert.equal((await PATCH(request({...legacy,revision:2,channelSettings:{}},'PATCH'),params)).status,200);
assert.deepEqual((await (await GET(new Request('https://example.test'),params)).json()).channelSettings,{});
assert.equal((await PATCH(request({...legacy,channelSettings:{reddit_title:'stale'}},'PATCH'),params)).status,409);
db.close();delete globalThis.settingsDB;
console.log('Channel settings passed: migration, actual draft routes, legacy preservation, clearing, revisions, mapping upgrade, conflicts and typed Notion writes.');
