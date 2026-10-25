/**
 * Live only if ALL of:
 *   1. CONTENT_OS_PUBLISH_LIVE=true
 *   2. Cuenta Estado === Activa
 *   3. Publicacion Modo === live (empty Modo is dry-run)
 *   4. Canal Estado del conector === live
 * Otherwise dry-run. Restream stays dry-run in the connector itself.
 */

import { contentOsPublishLiveEnabled } from '../config/content-os';

export type LiveGateInput = {
  cuentaEstado?: string;
  publicacionModo?: string | null;
  canalEstadoDelConector?: string;
  globalLive?: boolean;
};

export type LiveGateDecision = {
  dryRun: boolean;
  live: boolean;
  reason: string;
  flags: {
    globalLive: boolean;
    cuentaActiva: boolean;
    modoLive: boolean;
    canalLive: boolean;
    modo: string;
  };
};

export function normalizeModo(raw?: string | null): 'dry-run' | 'draft' | 'live' | '' {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return '';
  if (v === 'live') return 'live';
  if (v === 'draft') return 'draft';
  return 'dry-run';
}

export function resolveLiveGate(input: LiveGateInput = {}): LiveGateDecision {
  const globalLive = input.globalLive ?? contentOsPublishLiveEnabled();
  const cuentaActiva = input.cuentaEstado === 'Activa';
  const modo = normalizeModo(input.publicacionModo);
  const modoLive = modo === 'live';
  const canalLive = input.canalEstadoDelConector === 'live';

  const flags = { globalLive, cuentaActiva, modoLive, canalLive, modo: modo || '(empty)' };
  let reason = 'live';
  if (!globalLive) reason = 'global_flag_off';
  else if (!cuentaActiva) reason = `cuenta_not_activa:${input.cuentaEstado || 'empty'}`;
  else if (!modo) reason = 'modo_empty_defaults_dry_run';
  else if (!modoLive) reason = `modo_${modo}`;
  else if (!canalLive) reason = `canal_estado:${input.canalEstadoDelConector || 'empty'}`;

  const live = reason === 'live';
  return { dryRun: !live, live, reason, flags };
}

export function logLiveGate(
  decision: LiveGateDecision,
  ctx: { publicationId?: string; cuentaId?: string; canalId?: string; connector?: string }
): void {
  console.log(
    `[LIVE-GATE] publication=${ctx.publicationId || '?'} cuenta=${ctx.cuentaId || '?'} canal=${ctx.canalId || '?'} connector=${ctx.connector || '?'} dryRun=${decision.dryRun} reason=${decision.reason} flags=${JSON.stringify(decision.flags)}`
  );
}
