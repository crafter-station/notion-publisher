import assert from 'node:assert/strict';
const base = 'http://localhost:3000';
assert.equal((await fetch(base + '/api/v1/connections')).status, 401);
const login = await fetch(base + '/signin-with-chatgpt?return_to=/', { redirect: 'manual' });
const headers = { cookie: login.headers.get('set-cookie').split(';')[0], origin: base, 'Content-Type': 'application/json' };
const response = await fetch(base + '/api/v1/connections', { headers });
assert.equal(response.status, 200);
const { items } = await response.json();
for (const provider of ['gumroad', 'luma', 'github', 'skool']) {
 const item = items.find(i => i.provider === provider);
 if(provider === 'skool' && item?.state === 'subscription_required') {assert.equal(item.accounts.length,0);assert(item.message.includes('suscripción'));continue;}
 assert.equal(item?.state, 'read_verified', provider + ' live read');
 assert(item.accounts.length > 0, provider + ' account discovery');
 assert(item.accounts.every(a => Object.keys(a).sort().join(',') === 'channel,connected,hidden,id,name'));
}
const postly = items.find((item) => item.provider === 'postly');
assert.equal(postly.state, 'read_verified');
assert(postly.accounts.length > 0);
assert(postly.accounts.every((a) => typeof a.channel === 'string' && Object.keys(a).sort().join(',') === 'channel,connected,hidden,id,name'));
assert(postly.groups.every((g) => Array.isArray(g.channelIds) && Object.keys(g).sort().join(',') === 'channelIds,id,name'));
const tokenResponse = await fetch(base + '/api/v1/tokens', { method: 'POST', headers, body: JSON.stringify({ name: 'Connection read test', access: 'read' }) });
assert.equal(tokenResponse.status, 201);
const token = await tokenResponse.json();
try {
  const agent = await fetch(base + '/api/v1/connections', { headers: { Authorization: 'Bearer ' + token.token } });
  assert.equal(agent.status, 200);
  assert.equal((await agent.json()).items[0].state, 'read_verified');
} finally {
  assert.equal((await fetch(base + '/api/v1/tokens/' + token.id, { method: 'DELETE', headers })).status, 200);
}
console.log(JSON.stringify({ check: 'Live Postly discovery, account/group separation, safe fields, anonymous denial and read-only agent access', accounts: postly.accounts.length, groups: postly.groups.length, result: 'passed', externalBlocks: items.filter(i=>i.state==='subscription_required').map(i=>({provider:i.provider,state:i.state})) }));
