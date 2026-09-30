'use client';
// oxlint-disable next/no-html-link-for-pages -- Sites sign-in requires top-level anchor navigation.
import { useEffect, useState } from 'react';
import { ModeSwitcher, type PublisherMode } from '../components/mode-switcher';
import { PlanningView } from '../components/planning-view';
import { PublicationSetPicker, type PublicationSetSnapshot } from '../components/publication-set-picker';
import { MediaManager } from '../components/media-manager';
import Link from 'next/link';
import { TypefullyExport } from '../components/typefully-export';
import { RedditPreview } from '../components/reddit-preview';
import {
  postizFields,
  postizVersionKey,
  channelCopy,
} from '../lib/postiz-versions';
import { channelCatalog } from '../lib/channels';
import { threadChannels, threadPosts, threadText } from '../lib/thread-content';
import type { mergeNotionContent } from '../lib/notion-content';
import { Feather, PanelLeftClose, Settings2, Smartphone } from 'lucide-react';
type DraftResponse = {
  id: string;
  revision: number;
  status: string;
  title: string;
  body: string;
  versions: Record<string, string>;
  channelSettings?: Record<string, string>;
  mediaIds?: string[];
  publicationSet?: PublicationSetSnapshot | null;
  notion?: { notion_url: string; imported_at: string } | null;
  items: { id: string; title: string }[];
  error?: { message: string };
};
const categories = [...new Set(channelCatalog.map((c) => c.category))];
export default function Home() {
  const [setOperation, setSetOperation] = useState(false);
  const [mode, setMode] = useState<PublisherMode>('write');
  const [title, setTitle] = useState(''),
    [base, setBase] = useState(''),
    [channel, setChannel] = useState('X'),
    [versions, setVersions] = useState<Record<string, string>>({}),
    [preview, setPreview] = useState(false),
    [sidebar, setSidebar] = useState(true);
  const [channelSettings, setChannelSettings] = useState<
    Record<string, string>
  >({});
  const [publicationSet, setPublicationSet] = useState<PublicationSetSnapshot | null>(null);
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [postizCopy, setPostizCopy] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [notion, setNotion] = useState<DraftResponse['notion']>(null);
  const [syncPlan, setSyncPlan] = useState<
    | (ReturnType<typeof mergeNotionContent> & {
        remoteEditedAt?: string;
        outbound?: { available: boolean; fields?: string[]; reason?: string };
        attempts?: { id: string; state: string; created_at: string }[];
      })
    | null
  >(null);
  const [resolutions, setResolutions] = useState<
    Record<string, 'local' | 'notion'>
  >({});
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('draft');
  const [record, setRecord] = useState<{ id: string; revision: number } | null>(
      null,
    ),
    [saved, setSaved] = useState(
      JSON.stringify({
        title: '',
        body: '',
        versions: {},
        channelSettings: {},
        mediaIds: [],
        publicationSet: null,
      }),
    ),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState(''),
    [drafts, setDrafts] = useState<{ id: string; title: string }[]>([]);
  const snapshot = JSON.stringify({
      title,
      body: base,
      versions,
      channelSettings,
      mediaIds,
      publicationSet,
    }),
    dirty = snapshot !== saved;
  async function reconcileNotion(
    attemptId: string,
    action: 'confirm' | 'keep_notion',
  ) {
    if (!record || dirty || saving || !syncPlan?.remoteEditedAt) return;
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/drafts/' + record.id + '/notion', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          action,
          remoteEditedAt: syncPlan.remoteEditedAt,
        }),
      });
      const data = (await response.json()) as {
        message?: string;
        error?: { message: string };
      };
      if (!response.ok)
        throw new Error(data.error?.message || 'No se pudo cerrar el intento.');
      setMessage(data.message || 'Intento cerrado.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'No se pudo reconciliar.',
      );
    } finally {
      setSyncPlan(null);
      setSaving(false);
    }
  }
  async function pushNotion() {
    if (!record || dirty || saving || !syncPlan?.outbound?.available) return;
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/drafts/' + record.id + '/notion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revision: record.revision,
          remoteEditedAt: syncPlan.remoteEditedAt,
        }),
      });
      const data = (await response.json()) as {
        notionWritten?: boolean;
        error?: { message: string };
      };
      if (!response.ok)
        throw new Error(
          data.error?.message || 'No se pudo confirmar el guardado en Notion.',
        );
      setMessage(
        data.notionWritten
          ? 'Texto guardado y verificado en Notion.'
          : 'Notion ya contiene estos textos.',
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo guardar en Notion.',
      );
    } finally {
      setSyncPlan(null);
      setSaving(false);
    }
  }
  async function syncNotion(apply = false) {
    if (!record || dirty || saving) return;
    setSaving(true);
    setMessage('');
    if (apply) setLoading(true);
    try {
      const response = await fetch(
        '/api/v1/drafts/' + record.id + '/notion',
        apply
          ? {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                revision: record.revision,
                ...(syncPlan?.conflicts.length
                  ? { resolutions, remoteEditedAt: syncPlan.remoteEditedAt }
                  : {}),
              }),
            }
          : undefined,
      );
      const result = (await response.json()) as ReturnType<
        typeof mergeNotionContent
      > & { remoteEditedAt?: string; error?: { message: string } };
      if (!response.ok)
        throw new Error(
          result.error?.message || 'No se pudo comparar con Notion.',
        );
      if (!apply) {
        setSyncPlan(result);
        setResolutions({});
      } else {
        const fetched = await fetch('/api/v1/drafts/' + record.id);
        const data = (await fetched.json()) as DraftResponse;
        if (!fetched.ok)
          throw new Error(
            data.error?.message || 'Actualizado; vuelve a abrir el borrador.',
          );
        setTitle(data.title);
        setBase(data.body);
        setVersions(data.versions);
        setChannelSettings(data.channelSettings || {});
        setMediaIds(data.mediaIds || []);
        setPublicationSet(data.publicationSet || null);
        setRecord({ id: data.id, revision: data.revision });
        setStatus(data.status);
        setNotion(data.notion);
        setSaved(
          JSON.stringify({
            title: data.title,
            body: data.body,
            versions: data.versions,
            channelSettings: data.channelSettings || {},
            mediaIds: data.mediaIds || [],
            publicationSet: data.publicationSet || null,
          }),
        );
        setSyncPlan(null);
        setMessage(
          'Cambios de Notion incorporados. Las ediciones locales se conservaron.',
        );
        await refresh();
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'No se pudo sincronizar.',
      );
      setSyncPlan(null);
    } finally {
      setSaving(false);
      setLoading(false);
    }
  }
  async function refresh() {
    const res = await fetch('/api/v1/drafts');
    const data = (await res.json()) as DraftResponse;
    if (!res.ok)
      throw new Error(
        data.error?.message || 'No se pudieron cargar los borradores.',
      );
    setDrafts(data.items);
  }
  useEffect(() => {
    void fetch('/api/v1/session')
      .then(async (r) => {
        setSignedIn(r.ok);
        if (r.ok) setRole(((await r.json()) as { role: string }).role);
      })
      .catch(() => setSignedIn(false));
    void fetch('/api/v1/drafts')
      .then(async (r) => {
        const data = (await r.json()) as DraftResponse;
        if (!r.ok)
          throw new Error(
            data.error?.message || 'No se pudieron cargar los borradores.',
          );
        setDrafts(data.items);
      })
      .catch((e) => setMessage(e.message));
  }, []);
  async function save() {
    setSaving(true);
    setMessage('');
    const sent = snapshot;
    try {
      const res = await fetch(
        '/api/v1/drafts' + (record ? '/' + record.id : ''),
        {
          method: record ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...JSON.parse(sent),
            revision: record?.revision,
          }),
        },
      );
      const data = (await res.json()) as DraftResponse;
      if (!res.ok)
        throw new Error(data.error?.message || 'No se pudo guardar.');
      setRecord({ id: data.id, revision: data.revision });
      setStatus(data.status);
      setSaved(sent);
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }
  async function load(id: string) {
    if (saving) return;
    if (
      dirty &&
      !window.confirm('Hay cambios sin guardar. ¿Abrir otro borrador?')
    )
      return;
    setSaving(true);
    setLoading(true);
    try {
      const res = await fetch('/api/v1/drafts/' + id);
      const data = (await res.json()) as DraftResponse;
      if (!res.ok) throw new Error(data.error?.message || 'No se pudo abrir.');
      setSyncPlan(null);
      setNotion(data.notion);
      setTitle(data.title);
      setBase(data.body);
      setVersions(data.versions);
      setChannelSettings(data.channelSettings || {});
      setMediaIds(data.mediaIds || []);
        setPublicationSet(data.publicationSet || null);
      setRecord({ id: data.id, revision: data.revision });
      setStatus(data.status);
      setSaved(
        JSON.stringify({
          title: data.title,
          body: data.body,
          versions: data.versions,
          channelSettings: data.channelSettings || {},
          mediaIds: data.mediaIds || [],
            publicationSet: data.publicationSet || null,
        }),
      );
      setMessage('');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No se pudo abrir.');
    } finally {
      setLoading(false);
      setSaving(false);
    }
  }
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('draft');
    if (!id || !/^[a-zA-Z0-9-]{1,100}$/.test(id)) return;
    let active = true;
    void fetch('/api/v1/drafts/' + encodeURIComponent(id))
      .then(async (response) => {
        const data = (await response.json()) as DraftResponse;
        if (!response.ok)
          throw new Error(data.error?.message || 'No se pudo abrir.');
        if (!active) return;
        setTitle(data.title);
        setBase(data.body);
        setVersions(data.versions);
        setChannelSettings(data.channelSettings || {});
        setMediaIds(data.mediaIds || []);
        setPublicationSet(data.publicationSet || null);
        setSyncPlan(null);
        setNotion(data.notion);
        setRecord({ id: data.id, revision: data.revision });
        setStatus(data.status);
        setSaved(
          JSON.stringify({
            title: data.title,
            body: data.body,
            versions: data.versions,
            channelSettings: data.channelSettings || {},
            mediaIds: data.mediaIds || [],
            publicationSet: data.publicationSet || null,
          }),
        );
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, []);
  function newDraft() {
    if (
      saving ||
      (dirty &&
          !window.confirm('Hay cambios sin guardar. ¿Crear otro borrador?'))
    )
      return;
    setTitle('');
    setBase('');
    setVersions({});
    setChannelSettings({});
    setMediaIds([]);
    setPublicationSet(null);
    setRecord(null);
    setNotion(null);
    setSyncPlan(null);
    setStatus('draft');
    setSaved(
      JSON.stringify({
        title: '',
        body: '',
        versions: {},
        channelSettings: {},
        mediaIds: [],
        publicationSet: null,
      }),
    );
    setMessage('');
    setPreview(false);
  }
  async function review(action: string) {
    if (!record || dirty || saving) return;
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(`/api/v1/drafts/${record.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, revision: record.revision }),
      });
      const data = (await res.json()) as DraftResponse;
      if (!res.ok)
        throw new Error(
          data.error?.message || 'No se pudo actualizar la revisión.',
        );
      setRecord({ id: data.id, revision: data.revision });
      setStatus(data.status);
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : 'No se pudo actualizar la revisión.',
      );
    } finally {
      setSaving(false);
    }
  }
  const destination = channelCatalog.find((c) => c.id === channel)!;
  const channelName = destination.name;
  const isPostizCopy = postizCopy && Object.hasOwn(postizFields, channel);
  const versionKey = isPostizCopy ? postizVersionKey(channel) : channel;
  const custom = versions[versionKey] !== undefined,
    copy = channelCopy(versions, base, channel, isPostizCopy);
  const supportsThread = threadChannels.includes(channel);
  const posts = supportsThread ? threadPosts(copy) : [copy];
  function updatePosts(next: string[]) {
    // Thread edits always create a channel version: shared copy stays intact.
    setVersions({ ...versions, [versionKey]: threadText(next) });
  }
  return (
    <main className={`publisher ${sidebar ? '' : 'compact'}`}>
      <aside className="rail">
        <ModeSwitcher
          mode={mode}
          onChange={setMode}
          canNavigate={() =>
            !dirty ||
            window.confirm('Hay cambios sin guardar. ¿Salir del editor?')
          }
        />
        <div className="workspace">
          <b className="avatar">CS</b>
          <div>
            <strong>Crafter Station</strong>
            <small>Espacio de publicación</small>
          </div>
        </div>
        {mode !== 'write' && (
          <div className="mode-rail-context">
            <strong>
              {mode === 'plan' ? 'Flujo editorial' : 'Resultados'}
            </strong>
            <p>
              {mode === 'plan'
                ? 'Borradores, revisión y aprobación del equipo.'
                : 'Las métricas aparecerán cuando exista una conexión de análisis verificada.'}
            </p>
            <button onClick={() => setMode('write')}>Volver al borrador</button>
          </div>
        )}
        <div hidden={mode !== 'write'}>
          <div className="eyebrow">CREAR</div>
          <button className="nav-item" onClick={() => setPreview(false)}>
            <Feather size={18} /> Editor
          </button>
          <button className="nav-item" disabled={saving} onClick={newDraft}>
            + Nuevo borrador
          </button>
          <div className="draft-list">
            <div className="eyebrow">BORRADORES</div>
            {drafts.map((d) => (
              <button
                key={d.id}
                aria-current={record?.id === d.id ? 'page' : undefined}
                onClick={() => load(d.id)}
              >
                {d.title || 'Sin título'}
              </button>
            ))}
          </div>
        </div>
        <p className="rail-note">
          Una idea.
          <br />
          <strong>Una versión para cada canal.</strong>
        </p>
        <Link href="/sources" className="nav-item">
          Canales y conexiones
        </Link>
        <Link href="/reviews" className="nav-item">
          Revisiones del equipo
        </Link>
        <Link href="/settings" className="nav-item">
          Equipo y agentes
        </Link>
        <div className="rail-bottom">Open Publisher · En desarrollo</div>
      </aside>
      <section className="desk">
        <header className="topbar">
          <div>
            <button
              className="icon-button"
              aria-label="Alternar barra lateral"
              onClick={() => setSidebar(!sidebar)}
            >
              <PanelLeftClose size={18} />
            </button>
            <span>Open Publisher / </span>
            <strong>
              {mode === 'write'
                ? record
                  ? 'Editar publicación'
                  : 'Nueva publicación'
                : mode === 'plan'
                  ? 'Planificar'
                  : 'Analizar'}
            </strong>
          </div>
          <div>
            {signedIn === false && (
              <a
                className="signin-link"
                href="/signin-with-chatgpt?return_to=%2F"
                target="_top"
              >
                Iniciar sesión
              </a>
            )}
            <small aria-live="polite">
              {loading
                ? 'Abriendo borrador…'
                : signedIn === null
                  ? 'Cargando espacio…'
                  : saving
                    ? (setOperation ? 'Procesando conjunto…' : 'Guardando…')
                    : dirty
                      ? 'Cambios sin guardar'
                      : 'Guardado'}
            </small>
            <button
              className="save-button"
              disabled={saving || !dirty || !signedIn}
              onClick={save}
            >
              {loading
                ? 'Abriendo…'
                : saving
                  ? (setOperation ? 'Procesando conjunto…' : 'Guardando…')
                  : 'Guardar borrador'}
            </button>
          </div>
        </header>
        <div className="mobile-mode-switcher">
          <ModeSwitcher
            mode={mode}
            onChange={setMode}
            canNavigate={() =>
              !dirty ||
              window.confirm('Hay cambios sin guardar. ¿Salir del editor?')
            }
          />
        </div>
        <div hidden={mode !== 'write'}>
          <nav className="mobile-navigation" aria-label="Navegación móvil">
            <button disabled={saving} onClick={newDraft}>
              + Nuevo
            </button>
            <select
              aria-label="Abrir borrador"
              value={record?.id || ''}
              disabled={saving}
              onChange={(e) => {
                if (e.target.value) void load(e.target.value);
              }}
            >
              <option value="">Borradores</option>
              {drafts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title || 'Sin título'}
                </option>
              ))}
            </select>
            <Link href="/sources">Canales</Link>
            <Link href="/reviews">Revisiones</Link>
            <Link href="/settings">Equipo y agentes</Link>
          </nav>
          <div className="page-heading">
            <div className="eyebrow">TU PRÓXIMA PUBLICACIÓN</div>
            <h1>Una buena idea empieza aquí.</h1>
            <p>Escribe una vez. Dale a cada canal su propia voz.</p>
          </div>
          {signedIn && <PublicationSetPicker value={publicationSet} onChange={setPublicationSet} onBusyChange={busy => {setSaving(busy); setSetOperation(busy);}} disabled={saving} canEdit={role === 'administrator' || role === 'editor'} />}
          <div className="composer-shell">
            <section className="composer">
              <div className="composer-toolbar">
                <span>
                  <Feather size={17} /> Borrador
                </span>
                <div className="segmented">
                  <button
                    aria-pressed={!preview}
                    onClick={() => setPreview(false)}
                  >
                    Escribir
                  </button>
                  <button
                    aria-pressed={preview}
                    onClick={() => setPreview(true)}
                  >
                    Vista previa
                  </button>
                </div>
              </div>
              {notion && (
                <div className="catalog-editor-link">
                  <a href={notion.notion_url} target="_blank" rel="noreferrer">
                    Ver registro original en Notion ↗
                  </a>
                  <small>
                    Guardar actualiza Open Publisher. Compara para incorporar
                    cambios o guardar el texto también en Notion.
                  </small>
                  <button
                    disabled={saving || dirty}
                    onClick={() => void syncNotion()}
                  >
                    Comparar con Notion
                  </button>
                  {dirty && (
                    <small>Guarda tus cambios antes de comparar.</small>
                  )}
                  {syncPlan && (
                    <div className="notion-comparison">
                      <strong>
                        {syncPlan.conflicts.length
                          ? 'Hay cambios en conflicto'
                          : syncPlan.remoteChanged
                            ? 'Notion tiene cambios nuevos'
                            : 'Sin cambios nuevos en Notion'}
                      </strong>
                      {syncPlan.localChanged && (
                        <p>
                          Tus cambios locales se conservarán cuando afecten a
                          campos diferentes.
                        </p>
                      )}
                      {syncPlan.conflicts.map((conflict) => (
                        <details key={conflict.field}>
                          <summary>{conflict.field}</summary>
                          <p>Editor: {conflict.local ?? '(eliminado)'}</p>
                          <p>Notion: {conflict.remote ?? '(eliminado)'}</p>
                          <label>
                            Conservar para {conflict.field}
                            <select
                              disabled={saving || dirty}
                              value={resolutions[conflict.field] || ''}
                              onChange={(event) =>
                                setResolutions({
                                  ...resolutions,
                                  [conflict.field]: event.target.value as
                                    | 'local'
                                    | 'notion',
                                })
                              }
                            >
                              <option value="" disabled>
                                Elige una versión
                              </option>
                              <option value="local">Editor</option>
                              <option value="notion">Notion</option>
                            </select>
                          </label>
                        </details>
                      ))}
                      {syncPlan.attempts?.some((attempt) =>
                        ['writing', 'uncertain'].includes(attempt.state),
                      ) ? (
                        <div>
                          <p>
                            Hay un guardado en curso o sin confirmar. No se
                            repetirá automáticamente.
                          </p>
                          {role === 'administrator' ? (
                            syncPlan.attempts
                              .filter((attempt) =>
                                ['writing', 'uncertain'].includes(
                                  attempt.state,
                                ),
                              )
                              .map((attempt) => (
                                <div key={attempt.id}>
                                  <p>
                                    Enviado:{' '}
                                    {new Date(
                                      attempt.created_at,
                                    ).toLocaleString('es')}
                                    . La recuperación se habilita en el servidor
                                    tras dos minutos.
                                  </p>
                                  <button
                                    disabled={saving || dirty}
                                    onClick={() =>
                                      void reconcileNotion(
                                        attempt.id,
                                        'confirm',
                                      )
                                    }
                                  >
                                    Verificar texto y cerrar intento
                                  </button>
                                  <details>
                                    <summary>
                                      Conservar lo que está ahora en Notion
                                    </summary>
                                    <p>
                                      Revisa el registro original enlazado
                                      arriba. Esta acción cierra el intento y
                                      conserva el contenido actual de Notion. Tu
                                      borrador local permanece intacto y deberás
                                      comparar de nuevo antes de enviar.
                                    </p>
                                    <button
                                      disabled={saving || dirty}
                                      onClick={() =>
                                        void reconcileNotion(
                                          attempt.id,
                                          'keep_notion',
                                        )
                                      }
                                    >
                                      He revisado Notion; cerrar sin reenviar
                                    </button>
                                  </details>
                                </div>
                              ))
                          ) : (
                            <p>
                              Un administrador puede verificar y cerrar el
                              intento.
                            </p>
                          )}
                        </div>
                      ) : syncPlan.outbound?.available &&
                        !!syncPlan.outbound.fields?.length ? (
                        <div>
                          <p>
                            Campos que se actualizarán:{' '}
                            {syncPlan.outbound.fields.join(', ')}.
                          </p>
                          <small>
                            Los campos editados se guardan como texto plano.
                            Evita editarlos simultáneamente en Notion durante el
                            envío.
                          </small>
                          <button
                            disabled={saving || dirty}
                            onClick={() => void pushNotion()}
                          >
                            Guardar cambios en Notion
                          </button>
                        </div>
                      ) : syncPlan.outbound?.reason ? (
                        <p>{syncPlan.outbound.reason}</p>
                      ) : null}
                      {syncPlan.remoteChanged && (
                        <button
                          disabled={
                            saving ||
                            dirty ||
                            syncPlan.conflicts.some(
                              (conflict) => !resolutions[conflict.field],
                            )
                          }
                          onClick={() => void syncNotion(true)}
                        >
                          Incorporar cambios de Notion
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="catalog-editor-link">
                <Link href="/sources">
                  Explorar los {channelCatalog.length} canales →
                </Link>
                <small>Social · Eventos · Productos · Música y podcast</small>
              </div>
              <div className="editor-channel-picker">
                <label htmlFor="destination-channel">Canal de destino</label>
                <select
                  id="destination-channel"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                >
                  {categories.map((category) => (
                    <optgroup key={category} label={category}>
                      {channelCatalog
                        .filter((c) => c.category === category)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                            {versions[c.id] !== undefined
                              ? ' · Texto personalizado'
                              : ''}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
                <details className="channel-context">
                  <summary>Rutas y disponibilidad del canal</summary>
                  <small>
                    {destination.category} · Rutas:{' '}
                    {destination.routes.join(' / ')}
                  </small>
                  <small>
                    Prepara el texto de este destino. Los campos de publicación
                    y la vista nativa del canal todavía están en desarrollo.
                  </small>
                </details>
              </div>
              {!preview ? (
                <div className="writing-area">
                  <input
                    className="draft-title"
                    aria-label="Título interno"
                    placeholder="Título para organizar tu idea"
                    readOnly={loading}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  <label htmlFor={supportsThread ? 'post-0' : 'copy'}>
                    {custom
                      ? `Versión para ${channelName}${isPostizCopy ? ' · Postiz' : ''}`
                      : 'Contenido compartido'}
                  </label>
                  {supportsThread ? (
                    <div
                      className="thread-editor"
                      aria-label={`Publicaciones para ${channelName}`}
                    >
                      <p className="thread-help">
                        Cada bloque representa una publicación. Editarlo crea
                        una versión independiente para este canal.
                      </p>
                      {posts.map((post, index) => (
                        <div className="thread-post" key={index}>
                          <div className="thread-post-heading">
                            <label htmlFor={`post-${index}`}>
                              Publicación {index + 1}
                            </label>
                            <div className="thread-actions">
                              <button
                                type="button"
                                disabled={loading || index === 0}
                                aria-label={`Subir publicación ${index + 1}`}
                                onClick={() => {
                                  const next = [...posts];
                                  [next[index - 1], next[index]] = [
                                    next[index],
                                    next[index - 1],
                                  ];
                                  updatePosts(next);
                                }}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                disabled={loading || index === posts.length - 1}
                                aria-label={`Bajar publicación ${index + 1}`}
                                onClick={() => {
                                  const next = [...posts];
                                  [next[index + 1], next[index]] = [
                                    next[index],
                                    next[index + 1],
                                  ];
                                  updatePosts(next);
                                }}
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                disabled={loading || posts.length === 1}
                                aria-label={`Eliminar publicación ${index + 1}`}
                                onClick={() =>
                                  updatePosts(
                                    posts.filter((_, i) => i !== index),
                                  )
                                }
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                          <textarea
                            id={`post-${index}`}
                            placeholder={
                              index
                                ? 'Continúa el hilo…'
                                : 'Comienza tu publicación…'
                            }
                            readOnly={loading}
                            value={post}
                            onChange={(e) =>
                              updatePosts(
                                posts.map((text, i) =>
                                  i === index ? e.target.value : text,
                                ),
                              )
                            }
                          />
                          <small>
                            {Array.from(post).length} caracteres ·{' '}
                            {post.trim()
                              ? 'Texto preparado'
                              : 'Falta el texto de esta publicación'}
                          </small>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="add-thread-post"
                        disabled={loading}
                        onClick={() => updatePosts([...posts, ''])}
                      >
                        + Añadir publicación al hilo
                      </button>
                    </div>
                  ) : (
                    <textarea
                      id="copy"
                      placeholder="¿Qué quieres compartir con el mundo?"
                      readOnly={loading}
                      value={copy}
                      onChange={(e) =>
                        custom || isPostizCopy
                          ? setVersions({
                              ...versions,
                              [versionKey]: e.target.value,
                            })
                          : setBase(e.target.value)
                      }
                    />
                  )}
                  <MediaManager
                    key={record?.id || 'new'}
                    draftId={record?.id || null}
                    mediaIds={mediaIds}
                    disabled={loading || saving || role === 'approver'}
                    onAttach={(id) =>
                      setMediaIds((ids) =>
                        ids.includes(id) ? ids : [...ids, id],
                      )
                    }
                    onRemove={(id) =>
                      setMediaIds((ids) => ids.filter((value) => value !== id))
                    }
                  />
                  {channel === 'Reddit' && !isPostizCopy && (
                    <fieldset className="reddit-fields">
                      <legend>Opciones de Reddit · Composio</legend>
                      <label>
                        Título para Reddit
                        <input
                          value={channelSettings.reddit_title || ''}
                          placeholder={title || 'Usar título del borrador'}
                          maxLength={300}
                          disabled={loading}
                          onChange={(e) =>
                            setChannelSettings({
                              ...channelSettings,
                              reddit_title: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Comunidad
                        <input
                          value={channelSettings.reddit_subreddit || ''}
                          placeholder="r/comunidad"
                          disabled={loading}
                          onChange={(e) =>
                            setChannelSettings({
                              ...channelSettings,
                              reddit_subreddit: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Tipo de publicación
                        <select
                          value={channelSettings.reddit_kind || ''}
                          disabled={loading}
                          onChange={(e) =>
                            setChannelSettings({
                              ...channelSettings,
                              reddit_kind: e.target.value,
                            })
                          }
                        >
                          <option value="">
                            Automático según los campos de Notion
                          </option>
                          <option value="self">Texto</option>
                          <option value="link">Enlace</option>
                        </select>
                      </label>
                      <label>
                        Enlace de destino
                        <input
                          type="url"
                          value={channelSettings.reddit_link || ''}
                          placeholder="https://…"
                          disabled={loading}
                          onChange={(e) =>
                            setChannelSettings({
                              ...channelSettings,
                              reddit_link: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        ID de etiqueta (flair)
                        <input
                          value={channelSettings.reddit_flair || ''}
                          placeholder="ID de la etiqueta de esta comunidad"
                          disabled={loading}
                          onChange={(e) =>
                            setChannelSettings({
                              ...channelSettings,
                              reddit_flair: e.target.value,
                            })
                          }
                        />
                      </label>
                      <p>
                        Se guardan con el borrador. En registros vinculados
                        puedes compararlos y guardarlos en Notion. Publicar
                        desde esta web todavía no está disponible.
                      </p>
                    </fieldset>
                  )}
                  <div className="editor-footer">
                    <span>
                      {supportsThread
                        ? `${posts.length} publicaciones`
                        : `${Array.from(copy).length} caracteres`}
                    </span>
                    <span>Texto y versiones editables</span>
                  </div>
                </div>
              ) : (
                <div className="preview-area">
                  {channel === 'Reddit' && !isPostizCopy ? (
                    <RedditPreview
                      title={title}
                      body={copy}
                      settings={channelSettings}
                      linked={!!notion}
                      inherited={!custom}
                      signedIn={signedIn === true}
                    />
                  ) : (
                    <div
                      className="thread-preview"
                      aria-label={`Vista previa de ${channelName}`}
                    >
                      {posts.map((post, index) => (
                        <article className="preview-card" key={index}>
                          <div className="preview-user">
                            <b className="avatar">IV</b>
                            <div>
                              <strong>Tu cuenta</strong>
                              <small>
                                {channelName} · {index + 1} / {posts.length}
                              </small>
                            </div>
                          </div>
                          <p>
                            {post || 'Esta publicación todavía está vacía.'}
                          </p>
                        </article>
                      ))}
                      <p className="thread-help">
                        Vista orientativa del texto y del orden. Los medios,
                        límites y apariencia final todavía requieren validación
                        por plataforma.
                      </p>
                    </div>
                  )}
                </div>
              )}
              <output className="draft-notice">
                {message ||
                  (record
                    ? 'Borrador del equipo · Versión ' + record.revision
                    : 'Guarda tu idea para continuar desde otro dispositivo.')}
              </output>
            </section>
            <aside className="inspector">
              <h2>
                <Settings2 size={18} /> Versión de {channelName}
              </h2>
              {Object.hasOwn(postizFields, channel) && (
                <label className="option">
                  <span>Variante del texto</span>
                  <select
                    aria-label="Variante del proveedor"
                    value={isPostizCopy ? 'postiz' : 'general'}
                    onChange={(e) => setPostizCopy(e.target.value === 'postiz')}
                  >
                    <option value="general">General del canal</option>
                    <option value="postiz">Postiz</option>
                  </select>
                </label>
              )}
              {isPostizCopy && (
                <p>
                  Variante para Postiz. Si no hay texto propio, usa la versión
                  general del canal. Esto no conecta ni publica en Postiz.
                </p>
              )}
              <p>Conserva el mensaje central o adapta el texto a este canal.</p>
              <label
                className="option"
                aria-label="Personalizar texto del canal"
              >
                <span>
                  <strong>Personalizar texto</strong>
                  <small>Crear una versión independiente</small>
                </span>
                <input
                  type="checkbox"
                  disabled={loading}
                  checked={custom}
                  onChange={(e) => {
                    const next = { ...versions };
                    if (e.target.checked) next[versionKey] = copy;
                    else delete next[versionKey];
                    setVersions(next);
                  }}
                />
              </label>
              <hr />
              <div className="review-controls">
                <h3>
                  {status === 'approved'
                    ? 'Aprobado'
                    : status === 'in_review'
                      ? 'En revisión'
                      : 'Borrador'}
                </h3>
                <p>
                  {dirty
                    ? 'Guarda los cambios antes de solicitar o completar la revisión. Editar un contenido aprobado lo devuelve a borrador.'
                    : 'La aprobación queda registrada sobre esta versión del contenido.'}
                </p>
                {status === 'draft' && (
                  <button
                    className="save-button"
                    disabled={!record || dirty || saving}
                    onClick={() => void review('submit')}
                  >
                    Solicitar revisión
                  </button>
                )}
                {status === 'in_review' &&
                  ['administrator', 'approver'].includes(role) && (
                    <>
                      <button
                        className="save-button"
                        disabled={dirty || saving}
                        onClick={() => void review('approve')}
                      >
                        Aprobar versión
                      </button>
                      <button
                        disabled={dirty || saving}
                        onClick={() => void review('return')}
                      >
                        Devolver a borrador
                      </button>
                    </>
                  )}
              </div>
              <hr />
              {record && (
                <TypefullyExport
                  key={record.id + JSON.stringify(publicationSet)}
                  allowedAccounts={publicationSet?.accounts.filter(account => account.provider === 'typefully').map(account => account.accountId)}
                  draftId={record.id}
                  revision={record.revision}
                  dirty={dirty || saving || loading}
                />
              )}
              <h3>El contenido, bajo control</h3>
              {[
                [
                  'Escribe tu mensaje',
                  'El texto compartido es el punto de partida.',
                ],
                [
                  'Adapta cada versión',
                  'Cambia de canal sin perder la idea original.',
                ],
                [
                  'Revisa la lectura',
                  'Comprueba el contenido en la vista previa.',
                ],
              ].map(([a, b], i) => (
                <div className="instruction" key={a}>
                  <span>0{i + 1}</span>
                  <div>
                    <strong>{a}</strong>
                    <p>{b}</p>
                  </div>
                </div>
              ))}
              <div className="mobile-note">
                <Smartphone size={18} />
                Tu espacio, también en móvil.
              </div>
            </aside>
          </div>
          <footer className="desk-footer">
            <span>Menos pestañas. Más espacio para crear.</span>
            <span>Open Publisher / Crafter Station</span>
          </footer>
        </div>
        {mode === 'plan' && (
          <PlanningView
            onOpen={(id) => {
              void load(id);
              setMode('write');
            }}
          />
        )}
        {mode === 'analyze' && (
          <section className="mode-view">
            <h1>Analizar</h1>
            <p>El rendimiento de tus publicaciones, en un solo lugar.</p>
            <div className="analytics-empty">
              <h2>Aún no hay métricas conectadas</h2>
              <p>
                Las conexiones actuales no importan estadísticas de rendimiento.
                Esta vista mostrará datos por canal cuando su consulta esté
                integrada y verificada.
              </p>
              <button onClick={() => setMode('write')}>
                Volver a escribir
              </button>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
