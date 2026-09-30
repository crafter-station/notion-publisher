'use client';
import { useEffect, useState } from 'react';
import type { ConnectionInventory } from '../lib/server/connections';
const channels = ['X', 'LinkedIn', 'Threads', 'Bluesky', 'Mastodon'];
type Receipt = {
  social_set_id: number;
  revision: number;
  state: string;
  receipt: { private_url: string } | null;
};
export function TypefullyExport({
  draftId,
  revision,
  dirty,
  allowedAccounts,
}: {
  draftId: string;
  revision: number;
  dirty: boolean;
  allowedAccounts?: string[];
}) {
  const [connection, setConnection] = useState<ConnectionInventory | null>(
    null,
  );
  const [group, setGroup] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const path = '/api/v1/drafts/' + encodeURIComponent(draftId) + '/typefully';
  useEffect(() => {
    let active = true;
    fetch(path)
      .then(async (response) => {
        if (!response.ok)
          throw new Error('No se pudo consultar el estado de Typefully.');
        const result = (await response.json()) as { items: Receipt[] };
        if (active) setReceipts(result.items);
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, [path]);
  async function loadAccounts() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/connections?provider=typefully', {
        signal: AbortSignal.timeout(45000),
      });
      const result = (await response.json()) as {
        items: ConnectionInventory[];
      };
      if (!response.ok)
        throw new Error('No se pudieron consultar las cuentas.');
      const found = result.items.find(
        (item: ConnectionInventory) => item.provider === 'typefully',
      );
      if (found?.state !== 'read_verified')
        throw new Error(found?.message || 'Typefully no está disponible.');
      const filtered = {...found, groups: found.groups.filter(group => allowedAccounts === undefined || group.channelIds.some(id => allowedAccounts.includes(id)))};
      setConnection(filtered);
      setGroup(filtered.groups[0]?.id || '');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (dirty || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revision,
          socialSetId: Number(group),
          channels: selected,
        }),
      });
      const result = (await response.json()) as {
        revision: number;
        receipt: { private_url: string };
        message?: string;
        error?: { message: string };
      };
      if (!response.ok)
        throw new Error(
          result.error?.message || 'No se pudo confirmar el envío.',
        );
      setReceipts((previous) => [
        ...previous.filter((item) => item.social_set_id !== Number(group)),
        {
          social_set_id: Number(group),
          revision: result.revision,
          state: 'created',
          receipt: result.receipt,
        },
      ]);
      setMessage(
        result.message ||
          'Borrador privado creado. No está programado ni publicado.',
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const existing = receipts.find(
    (item) => String(item.social_set_id) === group,
  );
  const platform: Record<string, string> = {
    X: 'x',
    LinkedIn: 'linkedin',
    Threads: 'threads',
    Bluesky: 'bluesky',
    Mastodon: 'mastodon',
  };
  return (
    <section
      className="typefully-export"
      aria-label="Borrador privado en Typefully"
    >
      <h3>Continuar en Typefully</h3>
      <p>
        Crea una copia privada del texto. Los cambios posteriores se conservan
        aquí hasta que los adaptes en Typefully.
      </p>
      {receipts.map((item) => (
        <p key={item.social_set_id}>
          {item.receipt ? (
            <a href={item.receipt.private_url} target="_blank" rel="noreferrer">
              Abrir borrador · versión {item.revision}
            </a>
          ) : (
            'Hay una creación en curso o sin confirmar. Revisa Typefully antes de volver a enviar.'
          )}
        </p>
      ))}
      {!connection ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void loadAccounts()}
        >
          Consultar cuentas de Typefully
        </button>
      ) : (
        <>
          <label>
            Grupo de cuentas
            <select
              value={group}
              disabled={busy}
              onChange={(event) => {
                setGroup(event.target.value);
                setSelected([]);
              }}
            >
              {connection.groups.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset disabled={busy || !!existing}>
            <legend>Canales de esta copia</legend>
            {channels.map((channel) => {
              const connected = connection.accounts.some(
                (account) => account.id === group + ':' + platform[channel] && account.connected && !account.hidden && (allowedAccounts === undefined || allowedAccounts.includes(account.id)),
              );
              return (
                <label key={channel}>
                  <input
                    type="checkbox"
                    checked={selected.includes(channel)}
                    disabled={!connected}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? [...selected, channel]
                          : selected.filter((value) => value !== channel),
                      )
                    }
                  />
                  {channel}
                  {!connected && ' · No disponible en este conjunto'}
                </label>
              );
            })}
          </fieldset>
          <button
            type="button"
            disabled={busy || dirty || !group || !selected.length || !!existing}
            onClick={() => void send()}
          >
            {busy ? 'Procesando…' : 'Crear borrador privado'}
          </button>
          {dirty && <p>Guarda los cambios antes de crear la copia.</p>}
        </>
      )}
      {message && <output>{message}</output>}
    </section>
  );
}
