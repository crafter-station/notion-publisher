// Public discovery only: no credentials, uploads, submissions or purchases.
const assert = require('node:assert/strict');
const destinations = { Spotify: 'spotify', AppleMusic: 'apple music', YouTubeMusic: 'youtube music', AmazonMusic: 'amazon music', Tidal: 'tidal', Deezer: 'deezer', Pandora: 'pandora' };
function summarize(catalog, specification) {
  if (!Array.isArray(catalog?.stores) || !catalog.stores.length || !specification?.paths || typeof specification.paths !== 'object') throw new Error('Invalid public discovery response');
  const seen = new Set();
  const stores = catalog.stores.map(store => {
    if (!Number.isSafeInteger(store.storeId) || store.storeId <= 0 || typeof store.name !== 'string' || !store.name.trim() || !Array.isArray(store.aliases) || store.aliases.some(alias => typeof alias !== 'string') || seen.has(store.storeId)) throw new Error('Invalid or duplicate store');
    seen.add(store.storeId);
    return { id: store.storeId, name: store.name, aliases: store.aliases, partnerOnly: store.partnerOnly === true };
  });
  const mappedDestinations = Object.entries(destinations).map(([channelId, name]) => {
    const matches = stores.filter(store => [store.name, ...store.aliases].some(alias => alias.toLowerCase() === name));
    return { channelId, state: matches.length === 1 ? 'publicly_listed' : matches.length ? 'ambiguous' : 'not_in_public_catalog', storeId: matches.length === 1 ? matches[0].id : null };
  });
  return { evidence: 'public_discovery_only', stores, mappedDestinations,
    operations: Object.entries(specification.paths).flatMap(([path, methods]) => Object.keys(methods || {}).filter(method => ['get','post','patch','put','delete'].includes(method)).map(method => ({ method: method.toUpperCase(), path }))),
    accountVerified: false, publishingVerified: false, podcastSupportVerified: false };
}
async function read(path) {
  const response = await fetch('https://once.app/v1/' + path, { redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('Public discovery failed: HTTP ' + response.status);
  return response.json();
}
async function main() {
  if (process.argv.includes('--self-test')) {
    const catalog = {stores:[{storeId:9,name:'Spotify',aliases:['spotify']}]};
    const spec = {paths:{'/me':{get:{},parameters:[]},'/releases':{post:{}}}};
    const result = summarize(catalog,spec);
    assert.equal(result.mappedDestinations.find(x => x.channelId === 'Spotify').storeId,9);
    assert.equal(result.mappedDestinations.find(x => x.channelId === 'Deezer').state,'not_in_public_catalog');
    assert.equal(result.publishingVerified,false);
    assert.deepEqual(result.operations,[{method:'GET',path:'/me'},{method:'POST',path:'/releases'}]);
    assert.throws(() => summarize({stores:[...catalog.stores,...catalog.stores]},spec));
    assert.throws(() => summarize({stores:[{...catalog.stores[0],aliases:[null]}]},spec));
    assert.throws(() => summarize({},spec));
    console.log('ONCE public discovery checks passed. No network requests.'); return;
  }
  const [catalog,specification] = await Promise.all([read('distribution-stores'),read('openapi.json')]);
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), source: 'https://once.app/v1', ...summarize(catalog,specification) },null,2));
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode=1; });
module.exports={summarize};
