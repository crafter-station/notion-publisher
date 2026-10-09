// Inspect the installed image's registered providers without reading secret values.
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const container='open-publisher-postiz';
const code=String.raw`
const fs=require('fs');
const base='/app/libraries/nestjs-libraries/src/integrations/';
const manager=fs.readFileSync(base+'integration.manager.ts','utf8');
const list=manager.split('export const socialIntegrationList')[1].split('];')[0].replace(/\/\/[^\n]*/g,'');
const providers=[...list.matchAll(/new (\w+)\(/g)].map(([,cls])=>{
 const file=manager.match(new RegExp('import \\{ '+cls+' \\} from [\x27\x22]([^\x27\x22]+)'))[1].split('/').at(-1)+'.ts';
 const source=fs.readFileSync(base+'social/'+file,'utf8');
 const identifier=source.match(/identifier\s*=\s*['"]([^'"]+)/)?.[1];
 if(!identifier) throw new Error('Provider identifier missing');
 return {class:cls,identifier,name:source.match(/name\s*=\s*['"]([^'"]+)/)?.[1],connectionState:'not_verified',environmentReferences:[...new Set([...source.matchAll(/process(?:\?\.|\.)env(?:\?\.|\.)(\w+)/g)].map(x=>x[1]))].map(key=>({key,configured:!!process.env[key]}))};
});
console.log(JSON.stringify({checkedAt:new Date().toISOString(),source:'Installed image source registry; runtime API confirmation pending',versionFile:fs.readFileSync('/app/version.txt','utf8').trim(),count:providers.length,providers}));
`;
const report=JSON.parse(execFileSync('docker',['exec','-i',container,'node'],{input:code,encoding:'utf8',timeout:20000}));
report.imageId=execFileSync('docker',['inspect',container,'--format','{{.Image}}'],{encoding:'utf8',timeout:10000}).trim();
report.caveat='Environment references include optional flags and fallback keys; presence is not proof of required credentials, permissions or account connection.';
fs.writeFileSync('docs/postiz-channel-inventory.json',JSON.stringify(report,null,2)+'\n');
console.log(`${report.count} registered integrations inventoried in docs/postiz-channel-inventory.json; connections remain unverified.`);
