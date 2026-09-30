import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
if(process.env.OPEN_PUBLISHER_LIVE_NOTION_WRITE!=='1')throw new Error('Opt in with OPEN_PUBLISHER_LIVE_NOTION_WRITE=1. Creates and edits one private CMS test record.');
process.loadEnvFile('.dev.vars');
const base=process.env.OPEN_PUBLISHER_TEST_URL||'http://localhost:3001';
const site=new URL(base);if(!['localhost','127.0.0.1'].includes(site.hostname))throw new Error('This smoke is restricted to a local development server.');
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});assert(login.headers.get('set-cookie'));
const headers={cookie:login.headers.get('set-cookie').split(';')[0],origin:base,'Content-Type':'application/json'};
const api=async(path,method='GET',body)=>{const r=await fetch(base+'/api/v1/'+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();assert(r.ok,`${r.status}: ${data.error?.code}`);return data;};
const notion=async(path,method='GET',body)=>{const r=await fetch('https://api.notion.com/v1/'+path,{method,headers:{Authorization:'Bearer '+process.env.NOTION_TOKEN,'Notion-Version':'2022-06-28','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(20000)});assert(r.ok,'Notion HTTP '+r.status);return r.json();};
const file='.wrangler/notion-write-fixture.json';await mkdir('.wrangler',{recursive:true});
let fixture;try{fixture=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(!fixture){
 const database=await notion('databases/'+process.env.NOTION_DATABASE_ID);
 const title=Object.keys(database.properties).find(k=>database.properties[k].type==='title');assert(title);assert.equal(database.properties.Caption.type,'rich_text');
 await writeFile(file,JSON.stringify({state:'creating'}),{flag:'wx',mode:0o600});
 const page=await notion('pages','POST',{parent:{database_id:process.env.NOTION_DATABASE_ID},properties:{[title]:{title:[{text:{content:'[Private smoke] Open Publisher Notion roundtrip'}}]},Caption:{rich_text:[{text:{content:'Private CMS integration test. No channels or sources selected.'}}]}}});
 fixture={pageId:page.id,state:'created'};await writeFile(file,JSON.stringify(fixture),{mode:0o600});
}
assert(fixture.pageId,'Prior creation unconfirmed. Reconcile manually; do not create another page.');
const imported=await api('notion/import','POST',{pageId:fixture.pageId});
let draft=await api('drafts/'+imported.id);
await api('drafts/'+draft.id,'PATCH',{title:draft.title,body:'Private roundtrip verified by Open Publisher. Not scheduled or published.',versions:draft.versions,revision:draft.revision});
draft=await api('drafts/'+draft.id);
const comparison=await api('drafts/'+draft.id+'/notion');assert.equal(comparison.outbound.available,true);assert(comparison.outbound.fields.length<=1 && comparison.outbound.fields.every(field=>field==='Caption'));
const result=await api('drafts/'+draft.id+'/notion','PUT',{revision:draft.revision,remoteEditedAt:comparison.remoteEditedAt});assert.equal(result.notionWritten,comparison.outbound.fields.length>0);
const confirmed=await notion('pages/'+fixture.pageId);assert.equal(confirmed.properties.Caption.rich_text.map(t=>t.plain_text).join(''),draft.body);
const after=await api('drafts/'+draft.id+'/notion');assert.equal(after.localChanged,false);assert.equal(after.remoteChanged,false);assert.equal(after.attempts[0].state,'confirmed');
console.log(JSON.stringify({result:'Private Notion write and readback verified',pageId:fixture.pageId,draftId:draft.id,attemptId:result.attemptId}));
