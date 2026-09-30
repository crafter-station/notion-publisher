'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { channelCatalog } from '../../lib/channels';
import { connectionProviders } from '../../lib/connection-providers';
import type { ConnectionInventory } from '../../lib/server/connections';
type Inventory = {
  checkedAt: string;
  properties: { name: string; type: string }[];
  items: {
    id: string;
    url: string;
    title: string;
    sources: string[];
    channels: string[];
    status: string | null;
    providerStatuses: { provider: string; status: string }[];
    diagnostic: string;
  }[];
  nextCursor: string | null;
};
async function readInventory(cursor?: string) {
  const response = await fetch(
    '/api/v1/notion' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''),
  );
  const result = (await response.json()) as Inventory & {
    error?: { message: string };
  };
  if (!response.ok)
    throw new Error(result.error?.message || 'No se pudo consultar Notion.');
  return result;
}
async function readConnection(provider: string, signal: AbortSignal): Promise<ConnectionInventory> {
  try {
    const response = await fetch('/api/v1/connections?provider=' + provider, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]),
    });
    const result = await response.json() as {items: ConnectionInventory[]; error?: {message: string}};
    if (!response.ok) throw new Error(result.error?.message || 'No se pudieron consultar las cuentas.');
    if (!Array.isArray(result.items) || result.items.length !== 1 || result.items[0].provider !== provider)
      throw new Error('El proveedor devolvió una respuesta inesperada.');
    return result.items[0];
  } catch (error) {
    return {
      provider, state: 'read_failed', checkedAt: new Date().toISOString(), accounts: [], groups: [],
      message: error instanceof Error && error.name !== 'TimeoutError'
        ? error.message : 'La consulta tardó demasiado. Vuelve a cargar las conexiones.',
    };
  }
}
export default function Sources() {
  const [importing, setImporting] = useState<string | null>(null);
  const [importError, setImportError] = useState('');
  async function openNotion(pageId: string) {
    if (importing) return;
    setImporting(pageId);
    setImportError('');
    try {
      const response = await fetch('/api/v1/notion/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId }),
      });
      const result = (await response.json()) as {
        id: string;
        error?: { message: string };
      };
      if (!response.ok)
        throw new Error(
          result.error?.message || 'No se pudo abrir el registro.',
        );
      window.location.assign('/?draft=' + encodeURIComponent(result.id));
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'No se pudo abrir.');
      setImporting(null);
    }
  }
  const [category, setCategory] = useState('Todos');
  const [query, setQuery] = useState('');
  const [route, setRoute] = useState('Todos');
  const [data, setData] = useState<Inventory | null>(null);
  const [error, setError] = useState('');
  const [connections, setConnections] = useState<ConnectionInventory[]>([]);
  const [connectionError, setConnectionError] = useState('');
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [busy, setBusy] = useState(true);
  const pending = useRef(false);
  async function load(cursor?: string) {
    if (pending.current) return;
    pending.current = true;

    try {
      const result = await readInventory(cursor);
      setError('');
      setData((previous) =>
        cursor && previous
          ? {
              ...result,
              items: [
                ...new Map(
                  [...previous.items, ...result.items].map((item) => [
                    item.id,
                    item,
                  ]),
                ).values(),
              ],
            }
          : result,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo consultar Notion.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    void readInventory()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : 'No se pudo consultar Notion.',
          );
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void Promise.all(connectionProviders.map((provider) =>
      readConnection(provider, controller.signal).then((result) => {
        if (!active) return;
        setConnections((previous) => [...previous.filter((item) => item.provider !== provider), result]);
        if (result.state === 'read_failed')
          setConnectionError('Algunas conexiones no se pudieron consultar. Los resultados disponibles se conservan.');
      }),
    )).finally(() => { if (active) setConnectionsLoading(false); });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);
  const visible = channelCatalog.filter(
    (c) =>
      (category === 'Todos' || c.category === category) &&
      (route === 'Todos' || c.routes.some((r) => r === route)) &&
      (c.name + ' ' + c.routes.join(' '))
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const routes = [...new Set(channelCatalog.flatMap((c) => [...c.routes]))];
  return (
    <main className="settings-page ecosystem-page">
      <Link className="back-link" href="/">
        ← Volver al editor
      </Link>
      <div className="eyebrow">OPEN PUBLISHER / CANALES Y CONEXIONES</div>
      <h1>
        Un CMS. Múltiples proveedores.
        <br />
        <em>Todos tus canales.</em>
      </h1>
      <p>
        Organiza en Notion, elige quién entrega y adapta tu contenido a cada
        destino.
      </p>
      <nav className="layer-map" aria-label="Capas de Open Publisher">
        <a href="#cms">
          <small>01 / CONTENIDO</small>
          <strong>Notion CMS</strong>
          <span>Registro del equipo</span>
        </a>
        <a href="#providers">
          <small>02 / ORQUESTACIÓN</small>
          <strong>Proveedores</strong>
          <span>Conexiones y rutas</span>
        </a>
        <a href="#channels">
          <small>03 / DISTRIBUCIÓN</small>
          <strong>{channelCatalog.length} canales</strong>
          <span>4 categorías de publicación</span>
        </a>
      </nav>
      <section id="channels" className="catalog-section">
        <div className="source-heading">
          <div>
            <div className="eyebrow">DESTINOS</div>
            <h2>¿Dónde quieres publicar?</h2>
          </div>
          <span>
            {visible.length} de {channelCatalog.length} canales
          </span>
        </div>
        <div className="catalog-toolbar">
          <label>
            <span className="sr-only">Buscar canal o proveedor</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar canal o proveedor…"
            />
          </label>
          <label>
            <span className="sr-only">Filtrar proveedor</span>
            <select value={route} onChange={(e) => setRoute(e.target.value)}>
              <option value="Todos">Todos los proveedores</option>
              {routes.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="category-tabs" aria-label="Categorías">
          {['Todos', 'Social', 'Eventos', 'Productos', 'Música y podcast'].map(
            (c) => (
              <button
                key={c}
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
              >
                {c}
                <span>
                  {
                    channelCatalog.filter(
                      (item) => c === 'Todos' || item.category === c,
                    ).length
                  }
                </span>
              </button>
            ),
          )}
        </div>
        <div className="channel-grid">
          {visible.map((c) => {
            const accounts = connections.flatMap((conn) =>
              conn.accounts.filter(
                (a) =>
                  a.connected &&
                  [
                    ...(conn.provider === 'postiz'
                      ? c.postizIntegrations.map(
                          (integration) => integration.id,
                        )
                      : []),
                    c.name.toLowerCase(),
                    c.id.toLowerCase(),
                    c.name === 'Luma Event Page' ? 'luma' : '',
                    c.name === 'Gumroad Storefront' ? 'gumroad' : '',
                    c.name === 'GitHub Releases' ? 'github' : '',
                    c.name === 'X / Twitter' ? 'twitter' : '',
                    c.name === 'Google Business Profile'
                      ? 'google_business'
                      : '',
                  ]
                    .filter(Boolean)
                    .includes(a.channel.toLowerCase()),
              ),
            );
            return (
              <article className="channel-card" key={c.name}>
                <div className="channel-card-title">
                  {c.logo ? (
                    <Image
                      unoptimized
                      src={'/channels/' + c.logo}
                      alt=""
                      width="32"
                      height="32"
                    />
                  ) : (
                    <div className="channel-monogram">{c.name.slice(0, 2)}</div>
                  )}
                  <div>
                    <h3>{c.name}</h3>
                    <small>{c.category}</small>
                  </div>
                </div>
                <div className="route-tags">
                  {c.routes.map((r) => (
                    <span key={r}>{r}</span>
                  ))}
                </div>
                <p
                  className={
                    accounts.length ? 'connection-ok' : 'channel-pending'
                  }
                >
                  {accounts.length
                    ? `${accounts.length} cuentas verificadas en lectura`
                    : 'Ruta mapeada · cuenta por verificar'}
                </p>
                <details>
                  <summary>Ver ruta y disponibilidad</summary>
                  <p>
                    Notion → {c.routes.join(' / ')} → {c.name}
                  </p>
                  {c.postizIntegrations.length > 0 && (
                    <div>
                      <strong>Modalidades de Postiz</strong>
                      {c.postizIntegrations.map((integration) => (
                        <p key={integration.id}>
                          {integration.name} ·{' '}
                          {connections.some(
                            (conn) =>
                              conn.provider === 'postiz' &&
                              conn.state === 'read_verified' &&
                              conn.accounts.some(
                                (account) =>
                                  account.channel === integration.id &&
                                  account.connected,
                              ),
                          )
                            ? 'Cuenta verificada en lectura'
                            : 'Cuenta por verificar'}
                        </p>
                      ))}
                    </div>
                  )}
                  {accounts.map((a) => (
                    <p key={a.id}>{a.name}</p>
                  ))}
                  <p>
                    {c.routes.some((r) => r === 'Postiz')
                      ? 'Postiz está pendiente de instalación y conexión. '
                      : ''}
                    {c.category === 'Música y podcast'
                      ? 'La integración de distribución con ONCE está pendiente. '
                      : ''}
                    {c.name === 'Eventbrite'
                      ? 'Falta la API key de Eventbrite. '
                      : ''}
                    El catálogo describe cobertura. Los campos, permisos y
                    publicación deben validarse para cada ruta antes de
                    habilitar el envío.
                  </p>
                </details>
              </article>
            );
          })}
        </div>
        {!visible.length && (
          <output>
            No hay canales con estos filtros. Prueba otro nombre o proveedor.
          </output>
        )}
      </section>
      <section id="cms" className="settings-card">
        <div className="source-heading">
          <div>
            <div className="eyebrow">01 / CONTENIDO</div>
            <h2>Notion CMS</h2>
          </div>
          <button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void load();
            }}
          >
            {busy ? 'Consultando…' : 'Actualizar lectura'}
          </button>
        </div>
        {error && <output className="settings-error">{error}</output>}
        {data && (
          <>
            <p className="connection-ok">
              Conexión de lectura verificada · {data.properties.length} campos ·{' '}
              {data.items.length} registros cargados
              {data.nextCursor ? ' · Carga parcial' : ''}
            </p>
            <p>
              Abre un registro como borrador vinculado para editar su texto. Sus
              propiedades originales se conservan. Desde el editor puedes
              comparar cambios y guardar explícitamente el texto en Notion.
            </p>
            <p className="settings-footnote">
              Los estados siguientes pertenecen a publicaciones guardadas en
              Notion. Un registro con error no significa que la conexión del CMS
              esté fallando.
            </p>
            {importError && (
              <output className="settings-error">{importError}</output>
            )}
            <details>
              <summary>Ver registros y diagnósticos de publicación</summary>
              <div className="source-records">
                {data.items.map((item) => (
                  <article key={item.id}>
                    <div>
                      <a href={item.url} target="_blank" rel="noreferrer">
                        {item.title}
                      </a>
                      <small>
                        {[...item.sources, ...item.channels].join(' · ') ||
                          'Sin canales asignados'}
                      </small>
                      <button
                        disabled={!!importing}
                        onClick={() => void openNotion(item.id)}
                      >
                        {importing === item.id
                          ? 'Abriendo…'
                          : 'Abrir borrador vinculado'}
                      </button>
                      {item.diagnostic && (
                        <p className="record-diagnostic">{item.diagnostic}</p>
                      )}
                    </div>
                    <span>
                      {item.providerStatuses?.length
                        ? item.providerStatuses
                            .map((s) => `${s.provider}: ${s.status}`)
                            .join(' · ')
                        : `Registro: ${item.status || 'Sin estado'}`}
                    </span>
                  </article>
                ))}
              </div>
              {data.nextCursor && (
                <button
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void load(data.nextCursor!);
                  }}
                >
                  Cargar más registros
                </button>
              )}
            </details>
            <details>
              <summary>Ver campos de la plantilla</summary>
              <dl className="source-schema">
                {data.properties.map((p) => (
                  <div key={p.name}>
                    <dt>{p.name}</dt>
                    <dd>{p.type}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </>
        )}
      </section>
      <section id="providers">
        <div className="eyebrow">02 / ORQUESTACIÓN</div>
        <h2>Proveedores y cuentas</h2>
        <p>
          Una ruta puede ofrecer varios canales. Verificar una cuenta no
          verifica todas sus operaciones.
        </p>
        {connectionsLoading && <output>Consultando proveedores…</output>}
        {connectionError && (
          <output className="settings-error">{connectionError}</output>
        )}
        <div className="provider-grid">
          {[...connections].sort((a, b) => connectionProviders.indexOf(a.provider as typeof connectionProviders[number]) - connectionProviders.indexOf(b.provider as typeof connectionProviders[number])).map((c) => (
            <details className="settings-card" key={c.provider}>
              <summary>
                <strong>
                  {(
                    {
                      postly: 'Postly',
                      postiz: 'Postiz',
                      gumroad: 'Gumroad',
                      luma: 'Luma',
                      github: 'GitHub',
                      skool: 'MySkool',
                      typefully: 'Typefully vía Composio',
                      reddit: 'Reddit vía Composio',
                    } as Record<string, string>
                  )[c.provider] || c.provider}
                </strong>
                <span>
                  {c.state === 'read_verified'
                    ? `${c.accounts.length} cuentas · Lectura verificada`
                    : c.state === 'missing_configuration'
                      ? 'Por configurar'
                      : c.state === 'subscription_required'
                        ? 'Suscripción requerida'
                        : 'Error de lectura'}
                </span>
              </summary>
              <p>{c.message}</p>
              {c.coverage && (
                <section aria-label="Cobertura de variantes Postiz">
                  <h3>{c.coverage.active} de {c.coverage.total} variantes con cuenta activa</h3>
                  <p>
                    Catálogo de referencia de Open Publisher. La lectura de cuentas
                    no verifica las aplicaciones OAuth, los permisos ni la publicación.
                  </p>
                  {c.coverage.unverified > 0 && <p>No se pudo consultar el servidor; las variantes siguen sin verificar.</p>}
                  {c.coverage.unknownIdentifiers.length > 0 && (
                    <output>El servidor devolvió identificadores fuera del catálogo: {c.coverage.unknownIdentifiers.join(', ')}. La cobertura requiere revisión.</output>
                  )}
                  <ul className="postiz-coverage-list">
                    {c.coverage.variants.map((variant) => (
                      <li key={variant.id}>
                        <span>{variant.name}</span>
                        <span>{variant.state === 'active'
                          ? `${variant.activeAccounts} cuenta${variant.activeAccounts === 1 ? '' : 's'} activa${variant.activeAccounts === 1 ? '' : 's'}`
                          : variant.state === 'reconnect' ? 'Requiere reconexión'
                          : variant.state === 'missing' ? 'Sin cuenta conectada'
                          : 'Sin verificar'}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {c.accounts.map((a) => (
                <p key={a.id}>
                  {a.name} · {a.channel} ·{' '}
                  {a.connected ? 'Conectada' : 'Requiere reconexión'}
                  {a.hidden ? ' · Oculta' : ''}
                </p>
              ))}
              {c.groups.map((g) => (
                <p key={g.id}>
                  Grupo {g.name} · {g.channelIds.length} destinos
                </p>
              ))}
            </details>
          ))}
          {[
            [
              'Composio',
              'Transporta integraciones como Typefully, Reddit y Eventbrite. La conexión se verifica por toolkit.',
            ],

            ['ONCE', 'Distribución musical mapeada; integración pendiente.'],
            ['Buffer', 'Conector previsto. Cobertura todavía sin verificar.'],
            [
              'Hootsuite',
              'Conector previsto. Cobertura todavía sin verificar.',
            ],
          ].map(([name, note]) => (
            <article className="settings-card" key={name}>
              <h3>{name}</h3>
              <p>{note}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
