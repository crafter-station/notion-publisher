import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowUp, ArrowDown, MessageCircle, Share2, Link2 } from 'lucide-react';
import { redditPreview } from '../lib/reddit-preview';
import type { ConnectionInventory } from '../lib/server/connections';

export function RedditPreview({
  title,
  body,
  settings,
  linked,
  inherited,
  signedIn = false,
}: {
  title: string;
  body: string;
  settings: Record<string, string>;
  linked: boolean;
  inherited: boolean;
  signedIn?: boolean;
}) {
  const post = redditPreview(title, body, settings);
  const [result, setResult] = useState<{
    attempt: number;
    identity?: ConnectionInventory;
    error?: string;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const checking = signedIn && result?.attempt !== attempt;
  const identity = signedIn && !checking ? result?.identity : undefined;
  const identityError = signedIn && !checking ? result?.error : undefined;
  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    fetch('/api/v1/connections/reddit', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('No se pudo consultar la cuenta.');
        return (await response.json()) as ConnectionInventory;
      })
      .then((identity) => {
        if (!controller.signal.aborted) setResult({ attempt, identity });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({
            attempt,
            error: 'No se pudo consultar la cuenta de Reddit.',
          });
      });
    return () => controller.abort();
  }, [signedIn, attempt]);
  const account =
    identity?.state === 'read_verified'
      ? identity.accounts.find(
          (item) => item.connected && item.channel === 'reddit',
        )
      : undefined;
  return (
    <div className="reddit-preview" aria-label="Vista previa de Reddit">
      <p className="reddit-preview-label">
        Reddit · {post.kind === 'link' ? 'Enlace' : 'Texto'} · Simulación
      </p>
      <article className="reddit-post">
        <header className="reddit-post-author">
          <span className="reddit-community-icon" aria-hidden="true">
            r/
          </span>
          <div>
            <strong>r/{post.community || 'comunidad'}</strong>
            <small>{account?.name || 'Cuenta por verificar'} · Borrador</small>
          </div>
        </header>
        <h3>{post.title || 'Título de la publicación'}</h3>
        {post.kind === 'link' ? (
          post.url ? (
            <a
              className="reddit-link"
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Link2 size={22} aria-hidden="true" />
              <span>
                <strong>{post.domain}</strong>
                <small>{post.url}</small>
              </span>
            </a>
          ) : (
            <p className="reddit-empty">Añade el enlace para verlo aquí.</p>
          )
        ) : (
          <div className="reddit-post-body">
            <Markdown
              remarkPlugins={[remarkGfm]}
              skipHtml
              components={{
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
                img: ({ alt }) => (
                  <span className="reddit-empty">
                    [Imagen: {alt || 'sin descripción'}]
                  </span>
                ),
                table: ({ children }) => (
                  <div className="reddit-table">
                    <table>{children}</table>
                  </div>
                ),
              }}
            >
              {post.body || 'El texto de tu publicación aparecerá aquí.'}
            </Markdown>
          </div>
        )}
        <div className="reddit-post-actions" aria-hidden="true">
          <span>
            <ArrowUp size={17} /> Votar <ArrowDown size={17} />
          </span>
          <span>
            <MessageCircle size={17} /> Comentar
          </span>
          <span>
            <Share2 size={17} /> Compartir
          </span>
        </div>
      </article>
      <div className="reddit-identity">
        <output>
          {checking
            ? 'Verificando cuenta de Reddit…'
            : identityError ||
              (account
                ? `Cuenta verificada: ${account.name} · Composio`
                : identity?.message ||
                  'Inicia sesión para verificar tu cuenta de Reddit.')}
        </output>
        {signedIn && (
          <button
            type="button"
            disabled={checking}
            onClick={() => setAttempt((value) => value + 1)}
          >
            Actualizar cuenta
          </button>
        )}
      </div>
      {post.issues.length > 0 && (
        <div className="reddit-preview-checks">
          <strong>Campos por completar</strong>
          <ul>
            {post.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="thread-help">
        El icono de comunidad es ilustrativo. La etiqueta, los medios, la
        miniatura del enlace y las reglas de la comunidad requieren verificación
        en Reddit.
      </p>
      {linked && !settings.reddit_kind && (
        <p className="thread-help">
          Tipo automático: los medios existentes en Notion pueden convertir esta
          publicación en un enlace. Elige Texto o Enlace para fijar el tipo.
        </p>
      )}
      {linked && inherited && post.kind === 'self' && (
        <p className="thread-help">
          Esta vista usa el texto general. Para enviarlo desde Notion, activa
          «Personalizar texto» y guarda la versión de Reddit en Notion.
        </p>
      )}
      {post.kind === 'link' && body && (
        <p className="thread-help">
          El texto se conserva en el borrador; el envío como enlace por Composio
          usa el título y la URL.
        </p>
      )}
    </div>
  );
}
