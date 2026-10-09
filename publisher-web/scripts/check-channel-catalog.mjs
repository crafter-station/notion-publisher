import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../lib/postiz-integrations.ts',import.meta.url),'utf8'))+'\n'+(await readFile(new URL('../lib/channels.ts',import.meta.url),'utf8')).replace(/^import .*;$/m,'');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {channelCatalog}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
assert.equal(channelCatalog.length,48);
assert.equal(new Set(channelCatalog.map(c=>c.id)).size,48);
assert(channelCatalog.every(c=>/^[a-zA-Z0-9_-]{1,80}$/.test(c.id)));
for(const id of ['X','LinkedIn','Instagram','YouTube','Reddit','Bluesky','Mastodon'])assert(channelCatalog.some(c=>c.id===id));
assert.equal(channelCatalog.find(c=>c.name==='YouTube Music').id,'YouTubeMusic');
assert.deepEqual(Object.fromEntries(['Social','Eventos','Productos','Música y podcast'].map(category=>[category,channelCatalog.filter(c=>c.category===category).length])),{'Social':36,'Eventos':2,'Productos':3,'Música y podcast':7});
console.log('Channel catalog passed: all 48 destinations have unique API-compatible IDs; existing version keys preserved.');

const ids=new Set(channelCatalog.map(c=>c.id));
const {postizIntegrations}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
for(const integration of postizIntegrations){
 assert(ids.has(integration.channelId),`Missing destination for ${integration.id}`);
 assert(channelCatalog.find(c=>c.id===integration.channelId).routes.includes('Postiz'));
}
