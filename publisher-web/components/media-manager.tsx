'use client';
import { useEffect, useRef, useState } from 'react';
type Media = {
  id: string;
  fileName: string;
  size: number;
  state: string;
  partBytes: number;
  parts: { partNumber: number; uploaded: number }[];
};
type Attempt = { file: File; key: string; id?: string };
export function MediaManager({
  draftId,
  mediaIds,
  disabled,
  onAttach,
  onRemove,
}: {
  draftId: string | null;
  mediaIds: string[];
  disabled: boolean;
  onAttach: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [items, setItems] = useState<Record<string, Media>>({});
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    for (const id of mediaIds) {
      fetch('/api/v1/media/' + encodeURIComponent(id), {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok)
            throw new Error('No se pudo cargar la información del archivo.');
          const data: Media = await response.json();
          setItems((previous) => ({ ...previous, [id]: data }));
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setMessage(
              'No se pudo consultar algún adjunto. Vuelve a abrir el borrador.',
            );
        });
    }
    return () => controller.abort();
  }, [mediaIds]);
  async function upload(next: Attempt) {
    if (!draftId || busy || disabled) return;
    setAttempt(next);
    setBusy(true);
    setMessage('');
    setProgress(0);
    const controller = new AbortController();
    active.current = controller;
    async function request(path: string, method = 'GET', body?: BodyInit) {
      const response = await fetch(path, {
        method,
        body,
        signal: controller.signal,
        ...(method === 'POST'
          ? { headers: { 'Content-Type': 'application/json' } }
          : {}),
      });
      const data = (await response.json()) as Media & {
        error?: { message?: string };
      };
      if (!response.ok)
        throw new Error(data.error?.message || 'La carga no pudo completarse.');
      return data as Media;
    }
    try {
      let session: Media;
      if (next.id) session = await request('/api/v1/media/' + next.id);
      else {
        session = await request(
          '/api/v1/media',
          'POST',
          JSON.stringify({
            draftId,
            idempotencyKey: next.key,
            fileName: next.file.name,
            size: next.file.size,
            declaredType: next.file.type,
          }),
        );
        next = { ...next, id: session.id };
        setAttempt(next);
      }
      if (session.state === 'creating')
        throw new Error(
          'La sesión sigue sin confirmar. Conserva este intento y vuelve a consultar; no inicies otra carga.',
        );
      if (!['uploading', 'completing', 'ready'].includes(session.state))
        throw new Error('Esta carga no puede continuar.');
      const count = Math.ceil(next.file.size / session.partBytes);
      if (session.state === 'uploading')
        for (let part = 1; part <= count; part++) {
          if (!session.parts.some((p) => p.partNumber === part && p.uploaded)) {
            await request(
              '/api/v1/media/' + session.id + '?part=' + part,
              'PUT',
              next.file.slice(
                (part - 1) * session.partBytes,
                Math.min(part * session.partBytes, next.file.size),
              ),
            );
          }
          setProgress(Math.round((part / count) * 100));
        }
      if (session.state !== 'ready')
        session = await request('/api/v1/media/' + session.id, 'POST', '{}');
      setItems((previous) => ({ ...previous, [session.id]: session }));
      onAttach(session.id);
      setAttempt(null);
      setProgress(100);
      setMessage(
        'Archivo cargado de forma privada. Guarda el borrador para conservar el adjunto.',
      );
    } catch (error) {
      if (!controller.signal.aborted)
        setMessage(
          error instanceof Error
            ? error.message
            : 'No se pudo cargar el archivo.',
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="media-manager" aria-label="Archivos del borrador">
      <div className="media-heading">
        <h3>Imágenes, vídeo y audio</h3>
        <span>Privados</span>
      </div>
      <p>
        Se guardan en tu espacio. Adjuntarlos no los envía a ninguna plataforma.
      </p>
      {!draftId ? (
        <p>Guarda el borrador para añadir archivos.</p>
      ) : (
        <label className="media-picker">
          Añadir archivo
          <input
            aria-label="Añadir imagen, vídeo o audio"
            type="file"
            accept="image/*,video/*,audio/*"
            disabled={disabled || busy || !!attempt}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              if (
                !file.size ||
                file.size > 5 * 1024 * 1024 * 1024 ||
                !file.type.match(/^(image|video|audio)\//)
              ) {
                setMessage(
                  'Elige una imagen, vídeo o audio de hasta 5 GiB con un tipo reconocido.',
                );
                return;
              }
              void upload({ file, key: 'editor:' + crypto.randomUUID() });
            }}
          />
        </label>
      )}
      {busy && (
        <div aria-live="polite">
          <span>
            Subiendo {attempt?.file.name} · {progress}%
          </span>
          <progress max={100} value={progress} />
        </div>
      )}
      {attempt && !busy && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => void upload(attempt)}
        >
          Reanudar {attempt.file.name}
        </button>
      )}
      {!!mediaIds.length && (
        <ul>
          {mediaIds.map((id) => (
            <li key={id}>
              <div>
                <strong>{items[id]?.fileName || 'Consultando archivo…'}</strong>
                <small>
                  {items[id]
                    ? `${(items[id].size / 1024 / 1024).toFixed(1)} MiB`
                    : 'Adjunto privado'}
                </small>
              </div>
              <a
                href={'/api/v1/media/' + encodeURIComponent(id) + '?download=1'}
              >
                Descargar
              </a>
              <button
                type="button"
                aria-label={'Quitar ' + (items[id]?.fileName || 'adjunto')}
                disabled={disabled || busy}
                onClick={() => onRemove(id)}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && <output>{message}</output>}
    </section>
  );
}
