require('ts-node/register');
for (const key of ['NOTION_TOKEN','GUMROAD_TOKEN','POSTLY_API_KEY','POSTLY_WORKSPACE_ID','POSTLY_TARGET_PLATFORMS']) process.env[key]='fixture';
const assert=require('node:assert/strict');
const {updatePostlyMetadata}=require('../src/services/notion.service');
async function main(){
 const original=global.fetch,calls=[];
 try{
  global.fetch=async(_,options)=>{calls.push(JSON.parse(options.body));return new Response('{}');};
  await updatePostlyMetadata('fixture-page',{postly_status:'In progress',final_status:'In progress',postly_error:'1 publicado; 1 pendiente.',post_id:'Postly: fixture'});
  assert.equal(calls[0].properties['Postly Error'].rich_text[0].text.content,'1 publicado; 1 pendiente.');
  assert.equal(calls[0].properties.Status.status.name,'In progress');
  await updatePostlyMetadata('fixture-page',{postly_status:'Published',postly_error:''});
  assert.deepEqual(calls[1].properties['Postly Error'].rich_text,[]);
  console.log('Postly metadata checks passed: pending diagnosis and clearing resolved errors.');
 }finally{global.fetch=original;}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
