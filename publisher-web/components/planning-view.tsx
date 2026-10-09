'use client';
import { useEffect, useState } from 'react';
export function PlanningView({ onOpen }: { onOpen: (id: string) => void }) {
  const [items, setItems] = useState<
    { id: string; title: string; body: string; status: string }[]
  >([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1/drafts', { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as {
          items: { id: string; title: string; body: string; status: string }[];
          error?: { message: string };
        };
        if (!response.ok)
          throw new Error(
            data.error?.message || 'No se pudieron cargar los borradores.',
          );
        setItems(data.items);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refresh]);
  return (
    <section className="mode-view" aria-labelledby="plan-heading">
      <div className="mode-view-heading">
        <div>
          <h1 id="plan-heading">Planificar</h1>
          <p>Prepara el contenido y sigue su revisión.</p>
        </div>
        <button
          onClick={() => { setLoading(true); setError(''); setRefresh((value) => value + 1); }}
          disabled={loading}
        >
          Actualizar
        </button>
      </div>
      <p className="mode-caption">
        Hasta 100 borradores recientes. La programación y las entregas todavía
        no están disponibles en esta vista.
      </p>
      {loading ? (
        <output>Cargando borradores…</output>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : (
        <div className="planning-columns">
          {(
            [
              ['draft', 'Borradores'],
              ['in_review', 'En revisión'],
              ['approved', 'Aprobados'],
            ] as const
          ).map(([status, label]) => (
            <section key={status}>
              <h2>
                {label}
                <span>
                  {items.filter((item) => item.status === status).length}
                </span>
              </h2>
              {items
                .filter((item) => item.status === status)
                .map((item) => (
                  <button
                    className="planning-draft"
                    key={item.id}
                    onClick={() => onOpen(item.id)}
                  >
                    <strong>{item.title || 'Sin título'}</strong>
                    <p>{item.body || 'Sin texto'}</p>
                    <small>Abrir en el editor</small>
                  </button>
                ))}
              {!items.some((item) => item.status === status) && (
                <p className="mode-caption">
                  No hay borradores en este estado.
                </p>
              )}
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
