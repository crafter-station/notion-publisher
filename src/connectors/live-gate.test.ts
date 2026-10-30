import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONTENT_OS_PUBLISH_LIVE_ENV } from '../config/schema';
import { resolveConnectorLiveGate, resolveLiveGate } from './live-gate';

test('empty Modo is dry-run even when everything else is live', () => {
  const prev = process.env[CONTENT_OS_PUBLISH_LIVE_ENV];
  process.env[CONTENT_OS_PUBLISH_LIVE_ENV] = 'true';
  try {
    const d = resolveLiveGate({
      cuentaEstado: 'Activa',
      publicacionModo: '',
      canalEstadoDelConector: 'live',
    });
    assert.equal(d.dryRun, true);
    assert.equal(d.reason, 'modo_empty_defaults_dry_run');
  } finally {
    if (prev === undefined) delete process.env[CONTENT_OS_PUBLISH_LIVE_ENV];
    else process.env[CONTENT_OS_PUBLISH_LIVE_ENV] = prev;
  }
});

test('Pausada/Baja cuentas cannot go live', () => {
  const d = resolveLiveGate({
    globalLive: true,
    cuentaEstado: 'Pausada',
    publicacionModo: 'live',
    canalEstadoDelConector: 'live',
  });
  assert.equal(d.dryRun, true);
  assert.match(d.reason, /cuenta_not_activa/);
});

test('live requires global + Activa + Modo live + canal live', () => {
  const d = resolveLiveGate({
    globalLive: true,
    cuentaEstado: 'Activa',
    publicacionModo: 'live',
    canalEstadoDelConector: 'live',
  });
  assert.equal(d.live, true);
  assert.equal(d.dryRun, false);
});

test('connector flag off keeps a live Content OS gate dry-run', () => {
  const d = resolveConnectorLiveGate('', {
    globalLive: true,
    cuentaEstado: 'Activa',
    publicacionModo: 'live',
    canalEstadoDelConector: 'live',
  });
  assert.equal(d.dryRun, true);
  assert.equal(d.reason, 'connector_flag_off');
});

test('connector flag on still needs resolveLiveGate', () => {
  const d = resolveConnectorLiveGate('true');
  assert.equal(d.dryRun, true);
  assert.equal(d.live, false);
});

test('global flag off is the default dry-run reason', () => {
  const d = resolveLiveGate({
    globalLive: false,
    cuentaEstado: 'Activa',
    publicacionModo: 'live',
    canalEstadoDelConector: 'live',
  });
  assert.equal(d.dryRun, true);
  assert.equal(d.reason, 'global_flag_off');
});
