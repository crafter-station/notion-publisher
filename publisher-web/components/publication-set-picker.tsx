'use client';
import { useEffect, useState } from 'react';
import type { ConnectionInventory } from '../lib/server/connections';
export type PublicationSetSnapshot = {
  id: string;
  name: string;
  revision: number;
  accounts: { provider: string; accountId: string; sourceGroupId?: string }[];
};
const providers = ['typefully', 'postly', 'postiz', 'reddit', 'github', 'luma', 'gumroad', 'skool'];
async function json<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  const result = await response.json() as T & {error?:{message?:string}};
  if (!response.ok) throw new Error(result.error?.message || 'No se pudo completar la operación.');
  return result;
}
function snapshot(set: PublicationSetSnapshot): PublicationSetSnapshot {
  return { id: set.id, name: set.name, revision: set.revision, accounts: set.accounts };
}
export function PublicationSetPicker({ value, onChange, disabled, canEdit, onBusyChange }: {
  value: PublicationSetSnapshot | null;
  onChange: (value: PublicationSetSnapshot | null) => void;
  disabled: boolean;
  onBusyChange: (busy:boolean) => void;
  canEdit: boolean;
}) {
  const [refresh, setRefresh] = useState(0);
  const [sets, setSets] = useState<PublicationSetSnapshot[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('typefully');
  const [inventory, setInventory] = useState<ConnectionInventory | null>(null);
  const [accounts, setAccounts] = useState<PublicationSetSnapshot['accounts']>([]);
  const [attempt, setAttempt] = useState<{id:string;name:string;accounts:PublicationSetSnapshot['accounts']} | null>(null);
  const [verification, setVerification] = useState<{ id:string; revision:number; items:{provider:string;accountId:string;state:string}[] } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    async function list() {
      setError('');
      try {
        const items: PublicationSetSnapshot[] = [];
        let cursor: string | null = null;
        do {
          const result: {items:PublicationSetSnapshot[];nextCursor:string|null} = await json('/api/v1/sets' + (cursor ? '?after=' + encodeURIComponent(cursor) : ''), {signal:controller.signal});
          items.push(...result.items);
          cursor = result.nextCursor;
        } while (cursor);
        setSets(items);
      } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    }
    void list();
    return () => controller.abort();
  }, [refresh]);
  const current = sets.find(set => set.id === value?.id);
  const stale = !!value && !!current && current.revision !== value.revision;
  async function loadAccounts() {
    setBusy(true); onBusyChange(true); setError(''); setInventory(null);
    try {
      const result = await json<{items:ConnectionInventory[]}>('/api/v1/connections?provider=' + provider);
      const found = result.items[0];
      if (found?.state !== 'read_verified') throw new Error(found?.message || 'Conexión no disponible.');
      setInventory(found);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); onBusyChange(false); }
  }
  async function create() {
    setBusy(true); onBusyChange(true); setError('');
    const input = attempt || {id:crypto.randomUUID(), name:name.trim(), accounts};
    setAttempt(input);
    try {
      const result = await json<PublicationSetSnapshot>('/api/v1/sets', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
      setSets(previous => [...previous.filter(set => set.id !== result.id), result]);
      onChange(snapshot(result)); setCreating(false); setAttempt(null); setName(''); setAccounts([]); setInventory(null);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); onBusyChange(false); }
  }
  async function verify() {
    if (!value) return;
    setBusy(true); onBusyChange(true); setError(''); setVerification(null);
    try {
      const result = await json<{id:string;revision:number;items:{provider:string;accountId:string;state:string}[]}>('/api/v1/sets/' + value.id + '/verify');
      const fresh = await json<PublicationSetSnapshot>('/api/v1/sets/' + value.id);
      setSets(previous => [...previous.filter(set => set.id !== fresh.id), fresh]);
      setVerification(result);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); onBusyChange(false); }
  }
  const locked = disabled || busy;
  const states: Record<string,string> = {reference_verified:'Cuenta encontrada',account_missing:'Cuenta ausente',account_disconnected:'Desconectada',account_hidden:'Oculta',group_missing:'Grupo ausente',group_membership_mismatch:'Ya no pertenece al grupo',unsupported_provider:'Proveedor sin integración',missing_configuration:'Falta configuración',subscription_required:'Requiere suscripción',read_failed:'No se pudo consultar'};
  return <section className="publication-set-picker" aria-label="Conjunto del borrador">
    <div className="set-picker-row">
      <label>Publicar para
        <select value={value?.id || ''} disabled={locked || !canEdit} onChange={event => {
          setVerification(null);
          const next = sets.find(set => set.id === event.target.value);
          onChange(next ? snapshot(next) : null);
        }}>
          <option value="">Sin conjunto</option>
          {value && !current && <option value={value.id}>{value.name} · guardado</option>}
          {sets.map(set => <option key={set.id} value={set.id}>{set.name} · {set.accounts.length} {set.accounts.length === 1 ? 'cuenta' : 'cuentas'}</option>)}
        </select>
      </label>
      <button disabled={locked} onClick={() => setRefresh(previous => previous + 1)}>Actualizar conjuntos</button>
      {canEdit && <button disabled={locked} aria-expanded={creating} onClick={() => setCreating(!creating)}>{creating ? 'Cerrar' : '+ Nuevo conjunto'}</button>}
      {value && <button disabled={locked} onClick={() => void verify()}>Comprobar cuentas</button>}
    </div>
    {error && <p role="alert">{error}</p>}
    {value && <details><summary>{value.accounts.length} {value.accounts.length === 1 ? 'cuenta' : 'cuentas'} · revisión {value.revision}</summary>
      <ul>{value.accounts.map(account => {
        const check = verification?.id === value.id && verification.revision === value.revision ? verification.items.find(item => item.provider === account.provider && item.accountId === account.accountId) : null;
        return <li key={account.provider + ':' + account.accountId}><strong>{account.provider}</strong> <span>{account.accountId}</span><small>{check ? states[check.state] || check.state : 'Sin comprobar'}{account.sourceGroupId ? ' · grupo ' + account.sourceGroupId : ''}</small></li>;
      })}</ul>
      <p>Las cuentas se guardan con el borrador. Comprobarlas no autoriza una publicación.</p>
    </details>}
    {stale && <p className="set-stale">El conjunto tiene una nueva revisión. Este borrador conserva sus cuentas anteriores. <button disabled={locked || !canEdit} onClick={() => { onChange(snapshot(current!)); setVerification(null); }}>Adoptar revisión {current!.revision}</button></p>}
    {creating && <div className="set-create-panel">
      <label>Nombre del conjunto<input value={name} maxLength={120} disabled={locked || !!attempt} onChange={event => setName(event.target.value)} placeholder="Mi marca o proyecto" /></label>
      <div className="set-picker-row"><label>Proveedor<select value={provider} disabled={locked || !!attempt} onChange={event => {setProvider(event.target.value); setInventory(null);}}>{providers.map(item => <option key={item}>{item}</option>)}</select></label><button disabled={locked || !!attempt} onClick={() => void loadAccounts()}>{busy ? 'Consultando…' : 'Consultar cuentas'}</button></div>
      {inventory && <fieldset disabled={locked || !!attempt}><legend>Cuentas de {inventory.provider}</legend>{inventory.accounts.length === 0 && <p>No hay cuentas conectadas.</p>}{inventory.accounts.map(account => {
        const checked = accounts.some(item => item.provider === inventory.provider && item.accountId === account.id);
        return <label className="set-account-option" key={account.id}><input type="checkbox" checked={checked} disabled={!account.connected || account.hidden} onChange={event => setAccounts(previous => event.target.checked ? [...previous, {provider:inventory.provider,accountId:account.id,...(inventory.provider === 'typefully' ? {sourceGroupId:inventory.groups.find(group => group.channelIds.includes(account.id))?.id} : {})}] : previous.filter(item => !(item.provider === inventory.provider && item.accountId === account.id)))} /><span>{account.name}<small>{account.channel} · {!account.connected ? 'Desconectada' : account.hidden ? 'Oculta' : account.id}</small></span></label>;
      })}</fieldset>}
      <p>{accounts.length} cuentas seleccionadas. Puedes combinar varios proveedores.</p>
      <button disabled={locked || !name.trim() || !accounts.length} onClick={() => void create()}>{attempt ? 'Reintentar creación' : 'Crear y seleccionar'}</button>
      {attempt && <small>Si la respuesta se perdió, reintentar recupera el mismo conjunto.</small>}
    </div>}
  </section>;
}
