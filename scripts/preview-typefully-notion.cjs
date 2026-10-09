// Read-only Notion preview. This command never invokes Typefully or updates Notion.
require('ts-node/register/transpile-only');
const fs=require('node:fs'),dotenv=require('dotenv');
const {buildTypefullyDraft}=require('../src/services/typefully-notion.service');
async function main(){
 const [envFile,pageId]=process.argv.slice(2);
 if(!envFile||!pageId||!/^[a-f0-9-]{32,36}$/i.test(pageId))throw new Error('Usage: node scripts/preview-typefully-notion.cjs ENV_FILE NOTION_PAGE_ID');
 const env={...dotenv.parse(fs.readFileSync(envFile)),...process.env};
 if(!env.NOTION_TOKEN)throw new Error('NOTION_TOKEN is missing');
 const response=await fetch('https://api.notion.com/v1/pages/'+encodeURIComponent(pageId),{headers:{Authorization:'Bearer '+env.NOTION_TOKEN,'Notion-Version':'2022-06-28'},redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error('Notion read failed: HTTP '+response.status);
 const page=await response.json();
 const parent=(page.parent?.database_id||'').replace(/-/g,'');
 if(!env.NOTION_DATABASE_ID||parent!==env.NOTION_DATABASE_ID.replace(/-/g,''))throw new Error('Page is outside the configured Publisher database');
 console.log(JSON.stringify({mode:'preview',notionPageId:page.id,draft:buildTypefullyDraft(page.properties)},null,2));
}
main().catch(error=>{console.error(error instanceof TypeError?'Network or response failure':error.message);process.exitCode=1;});
