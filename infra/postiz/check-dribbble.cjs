const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
require('/app/node_modules/reflect-metadata');

async function main() {
  // Never permit real network calls, including when this runs inside the active container.
  let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls++; throw new Error('Unexpected network request'); };
  for (const app of ['backend', 'orchestrator']) {
    const base = `/app/apps/${app}/dist/libraries/nestjs-libraries/src/integrations/`;
    const { DribbbleProvider } = require(base + 'social/dribbble.provider.js');
    const provider = new DribbbleProvider();
    provider.fetch = globalThis.fetch;
    for (const token of ['', 'fixture-refresh-token']) {
      await assert.rejects(provider.refreshToken(token), /OAuth reconnection/);
    }
    assert.equal(networkCalls, 0, 'Dribbble must never send renewal credentials to Pinterest');

    // Exercise the installed refresh service with its dependency imports stubbed;
    // no Prisma, Temporal or notification transports may be constructed by this test.
    const exports = {};
    vm.runInNewContext(fs.readFileSync(base + 'refresh.integration.service.js', 'utf8'), {
      exports,
      require: name => name === 'tslib' ? {
        __decorate: (_decorators, target) => target, __param: () => {}, __metadata: () => {},
      } : name === '@nestjs/common' ? {
        Injectable: () => () => {}, Inject: () => () => {}, forwardRef: fn => fn,
      } : {},
    });
    const calls = [];
    const service = new exports.RefreshIntegrationService(
      { getSocialIntegration: () => provider },
      Object.fromEntries(['refreshNeeded', 'informAboutRefreshError', 'disconnectChannel', 'createOrUpdateIntegration'].map(name => [name, async () => calls.push(name)])),
      {},
    );
    assert.equal(await service.refresh({ providerIdentifier: 'dribbble', refreshToken: '', id: 'fixture', organizationId: 'fixture' }), false);
    assert.deepEqual(calls, ['refreshNeeded', 'informAboutRefreshError', 'disconnectChannel']);

    // Keep initial OAuth exchange intact, verified against fake Dribbble responses.
    const urls = [];
    provider.fetch = async url => {
      urls.push(url);
      return { json: async () => url.startsWith('https://dribbble.com/oauth/token?')
        ? { access_token: 'fixture-access', scope: 'public upload' }
        : { id: 123, name: 'Fixture', avatar_url: '', login: 'fixture' } };
    };
    const authenticated = await provider.authenticate({ code: 'fixture-code', codeVerifier: 'fixture', refresh: '' });
    assert.equal(authenticated.accessToken, 'fixture-access');
    assert.equal(authenticated.refreshToken, '');
    assert.equal(urls.length, 2);
    assert.ok(urls[0].startsWith('https://dribbble.com/oauth/token?'));
    assert.equal(urls[1], 'https://api.dribbble.com/v2/user');
  }
  assert.equal(networkCalls, 0);
  console.log('Both Postiz runtimes: no renewal request, reconnect signal, unchanged initial OAuth exchange.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
