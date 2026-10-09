const assert = require('node:assert/strict');
const { summarizeCoverage } = require('./lib/postiz-coverage.cjs');
const { providers } = require('../docs/postiz-channel-inventory.json');
assert.equal(summarizeCoverage(providers, null).unverified, 34);
assert.equal(summarizeCoverage(providers, []).missing, 34);
const account = (id, identifier, disabled = false) => ({ id, identifier, disabled });
const partial = summarizeCoverage(providers, [account('1', 'linkedin'), account('2', 'linkedin'), account('3', 'linkedin-page', true), account('4', 'instagram'), account('5', 'unknown')]);
assert.equal(partial.active, 2); // Two LinkedIn accounts still cover only one integration.
assert.equal(partial.disabled, 1);
assert.equal(partial.channels.find(c => c.identifier === 'instagram-standalone').state, 'missing');
assert.deepEqual(partial.unregisteredIdentifiers, ['unknown']);
assert.equal(partial.total, 34);
assert.equal(summarizeCoverage(providers, providers.map((p, i) => account(String(i), p.identifier))).active, 34);
assert.throws(() => summarizeCoverage(providers, [account('', 'x')]));
assert.throws(() => summarizeCoverage(providers, [{ id: 'x', identifier: 'x' }]));
assert.throws(() => summarizeCoverage([...providers, providers[0]], []));
console.log('Postiz coverage: variants, disabled accounts, unknown IDs, malformed responses and full inventory verified.');
