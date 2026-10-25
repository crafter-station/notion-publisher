import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getConnector, listConnectors, resolveConnectorId } from './registry';

test('every registered connector implements validate/publish/capabilities', () => {
  for (const c of listConnectors()) {
    assert.equal(typeof c.validate, 'function');
    assert.equal(typeof c.publish, 'function');
    const cap = c.capabilities();
    assert.equal(cap.id, c.id);
    assert.equal(cap.dryRunDefault, true);
    assert.ok(cap.webhook.startsWith('POST /webhooks/'));
  }
});

test('resolveConnectorId maps Canales Conector + Familia', () => {
  assert.equal(resolveConnectorId({ canalConector: 'Postiz' }), 'postiz');
  assert.equal(resolveConnectorId({ canalConector: 'Typefully' }), 'typefully');
  assert.equal(resolveConnectorId({ canalConector: 'Composio', canalFamilia: 'Social' }), 'composio-reddit');
  assert.equal(
    resolveConnectorId({ canalConector: 'Composio', canalFamilia: 'Eventos' }),
    'composio-eventbrite'
  );
  assert.equal(resolveConnectorId({ canalConector: 'Nativo', canalFamilia: 'Live' }), 'restream');
  assert.equal(resolveConnectorId({ canalNombre: 'Reddit r/test', canalConector: 'Composio' }), 'composio-reddit');
});

test('getConnector returns the restream dry-run-only adapter', () => {
  const cap = getConnector('restream').capabilities();
  assert.equal(cap.liveAllowed, false);
});
