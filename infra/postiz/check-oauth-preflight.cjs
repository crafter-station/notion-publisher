const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
async function main() {
  const source = fs.readFileSync('/app/apps/backend/dist/apps/backend/src/api/routes/integrations.controller.js', 'utf8');
  const start = source.indexOf('async getIntegrationUrl('), end = source.indexOf('async setTime(', start);
  assert.ok(start >= 0 && end > start);
  const env = {}, writes = [];
  const handler = vm.runInNewContext('({' + source.slice(start, end).trim() + '})', {
    process: {env}, redis_service_1: {ioRedis: {set: async (...args) => writes.push(args)}},
  }).getIntegrationUrl;
  let providerCalls = 0;
  const target = {_integrationManager: {
    getAllowedSocialsIntegrations: () => ['linkedin','linkedin-page','instagram','instagram-standalone','bluesky'],
    getSocialIntegration: () => { providerCalls++; return {generateAuthUrl: async () => ({state:'fixture-state',codeVerifier:'fixture-verifier',url:'https://example.com/oauth'})}; },
  }};
  const call = identifier => handler.call(target, identifier, '', '', '', '', {id:'fixture-org'});
  for (const id of ['linkedin','linkedin-page','instagram','instagram-standalone']) {
    const result = await call(id);
    assert.equal(result.err.code, 'oauth_app_not_configured');
    assert.equal(result.err.missing.length, 2); assert.ok(!result.url);
    assert.ok(result.err.message.includes(id));
  }
  assert.equal(providerCalls,0); assert.equal(writes.length,0);
  env.LINKEDIN_CLIENT_ID = 'secret-client';
  assert.equal((await call('linkedin')).err.missing.length, 1);
  assert.ok(!JSON.stringify(await call('linkedin')).includes('secret-client'));
  env.LINKEDIN_CLIENT_SECRET = '  ';
  assert.equal((await call('linkedin')).err.code, 'oauth_app_not_configured');
  env.LINKEDIN_CLIENT_SECRET = 'secret-value';
  assert.equal((await call('linkedin')).url,'https://example.com/oauth');
  assert.equal(providerCalls,1); assert.equal(writes.length,3);
  assert.equal((await call('bluesky')).url,'https://example.com/oauth');
  await assert.rejects(()=>call('unknown'));
  for(const name of ['0irk~psyjct7f.js','0jgp694k2b-.0.js']) {
    const chunk=fs.readFileSync('/app/apps/frontend/.next/static/chunks/'+name,'utf8');
    new vm.Script(chunk); // Validate the entire patched JavaScript chunk.
    const match=chunk.match(/\(typeof o==="object"&&typeof o.message==="string"\?o.message:[jC]\("could_not_connect_to_platform","Could not connect to the platform"\)\)/);
    assert.ok(match);
    for(const err of [true,{message:'Configure OAuth app keys'}]) {
      const result=vm.runInNewContext(match[0],{o:err,j:()=> 'Fallback',C:()=> 'Fallback'});
      assert.equal(result,err===true?'Fallback':err.message);
    }
  }
  console.log('Installed OAuth handler: missing keys stop before provider/Redis, configured and unrelated routes preserved; frontend messages verified. No network.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
