// Diagnose existing Notion error rows without contacting publication endpoints.
const fs = require('node:fs');
const path = require('node:path');
async function main() {
 const [envFile, mode = '--preview'] = process.argv.slice(2);
 if (!envFile || !['--preview','--annotate'].includes(mode)) throw new Error('Usage: node scripts/review-postly-errors.cjs ENV_FILE [--preview|--annotate]');
 const env = {...require('dotenv').parse(fs.readFileSync(envFile)),...process.env};
 if (!env.NOTION_TOKEN || !env.NOTION_DATABASE_ID) throw new Error('Missing Notion configuration');
 const request = async (route, method = 'GET', body) => {
  const r = await fetch('https://api.notion.com/v1/'+route,{method,headers:{Authorization:'Bearer '+env.NOTION_TOKEN,'Notion-Version':'2022-06-28','Content-Type':'application/json'},body:body&&JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(20000)});
  if (!r.ok) throw new Error('Notion HTTP '+r.status);
  return r.json();
 };
 let cursor, rows=[];
 do {
  const d=await request('databases/'+encodeURIComponent(env.NOTION_DATABASE_ID)+'/query','POST',{page_size:100,filter:{and:[{property:'Status',status:{equals:'Error'}},{property:'Source Tags',multi_select:{contains:'Postly'}}]},...(cursor?{start_cursor:cursor}:{})});
  rows.push(...d.results); cursor=d.has_more?d.next_cursor:null;
 } while(cursor);
 const text=p=>(p?.rich_text||[]).map(t=>t.plain_text??t.text?.content??'').join('');
 const plan=rows.filter(r=>!text(r.properties['Postly Error'])).map(r=>{
  const log=text(r.properties['Post ID']);
  const findings=[];
  if(r.properties['Postly URL']?.url)findings.push('tiene un enlace publicado');
  if(/pending/i.test(log))findings.push('registra destinos pendientes');
  if(/ERR:/i.test(log))findings.push('registra rechazos por destino');
  return {id:r.id,lastEdited:r.last_edited_time,diagnostic:'Revisión del registro previo: '+(findings.join('; ')||'no permite determinar el resultado por destino')+'. Estado actual en Postly aún sin reconciliar. Consultar el post existente antes de reintentar; no reenviar a destinos ya publicados.'};
 });
 const output=path.resolve(__dirname,'../data/postly-error-review.json');
 fs.mkdirSync(path.dirname(output),{recursive:true,mode:0o700});
 fs.writeFileSync(output,JSON.stringify({checkedAt:new Date().toISOString(),mode,plan},null,2),{mode:0o600});
 const counts={mode,errorRows:rows.length,emptyDiagnostics:plan.length,annotated:0,skippedChanged:0};
 if(mode==='--annotate')for(const item of plan){
  const current=await request('pages/'+encodeURIComponent(item.id));
  if(current.last_edited_time!==item.lastEdited||text(current.properties['Postly Error'])){counts.skippedChanged++;continue;}
  const updated=await request('pages/'+encodeURIComponent(item.id),'PATCH',{properties:{'Postly Error':{rich_text:[{text:{content:item.diagnostic}}]}}});
  if(text(updated.properties['Postly Error'])!==item.diagnostic)throw new Error('Diagnostic writeback mismatch');
  counts.annotated++;
  // Respect Notion's request rate with sequential, bounded batches.
  await new Promise(resolve=>setTimeout(resolve,700));
 }
 console.log(JSON.stringify(counts));
}
main().catch(error=>{console.error(error instanceof TypeError?'Network/response failure; inspect Notion before retrying.':error.message);process.exitCode=1;});
