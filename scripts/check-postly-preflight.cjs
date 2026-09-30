require('ts-node/register');
for(const key of ['NOTION_TOKEN','GUMROAD_TOKEN','POSTLY_API_KEY','POSTLY_WORKSPACE_ID','POSTLY_TARGET_PLATFORMS'])process.env[key]='fixture';
const assert=require('node:assert/strict');
const notion=require('../src/services/notion.service');
const {PostlyService}=require('../src/services/postly.service');
const {executePublishPostlyUseCase}=require('../src/use-cases/publish-postly.use-case');
async function main(){
 const update=notion.updatePostlyMetadata,create=PostlyService.prototype.createPost,log=console.log,error=console.error;
 let calls=0;
 try{
  console.log=()=>{};console.error=()=>{};
  notion.updatePostlyMetadata=async()=>({success:false,error:'Notion unavailable'});
  PostlyService.prototype.createPost=async()=>{calls++;throw Error('Must not publish');};
  await assert.rejects(executePublishPostlyUseCase({notion_page_id:'fixture',workspace_id:'fixture',target_platforms:[{id:'fixture',identifier:'x'}],content:{}}),/nothing sent to Postly/);
  assert.equal(calls,0);
 }finally{notion.updatePostlyMetadata=update;PostlyService.prototype.createPost=create;console.log=log;console.error=error;}
 console.log('Postly preflight check passed: failed Notion write prevents any publication request.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
