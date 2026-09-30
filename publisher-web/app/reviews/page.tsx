'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
type ReviewStatus = 'in_review' | 'approved' | 'draft';
type Draft = { id: string; title: string; revision: number; status: string; updated_at: string };
const labels: Record<ReviewStatus, string> = {in_review: 'Pendientes', approved: 'Aprobados', draft: 'Borradores'};
export default function Reviews() {
  const [status, setStatus] = useState<ReviewStatus>('in_review');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{status: ReviewStatus; attempt: number; items: Draft[]; error?: string} | null>(null);
  const current = result?.status === status && result.attempt === attempt ? result : null;
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1/drafts?status=' + status, {signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)])})
      .then(async response => {
        const data = await response.json() as {items: Draft[]; error?: {message: string}};
        if (!response.ok) throw new Error(data.error?.message || 'No se pudieron cargar los borradores.');
        if (!controller.signal.aborted) setResult({status, attempt, items: data.items});
      })
      .catch(error => {
        if (!controller.signal.aborted) setResult({status, attempt, items: [], error: error instanceof Error ? error.message : 'No se pudieron cargar los borradores.'});
      });
    return () => controller.abort();
  }, [status, attempt]);
  return <main className="settings-page review-page">
    <Link className="back-link" href="/">← Volver al editor</Link>
    <div className="eyebrow">OPEN PUBLISHER / EQUIPO</div>
    <h1>Revisiones del equipo</h1>
    <p>Abre el contenido para revisar sus versiones por canal. La aprobación corresponde a una versión concreta y se invalida al editarla.</p>
    <nav className="review-filters" aria-label="Estado de revisión">
      {(Object.keys(labels) as ReviewStatus[]).map(value => <button key={value} aria-pressed={status === value} onClick={() => setStatus(value)}>{labels[value]}</button>)}
      <button onClick={() => setAttempt(value => value + 1)} disabled={!current}>Actualizar</button>
    </nav>
    {!current && <output>Cargando {labels[status].toLowerCase()}…</output>}
    {current?.error && <output className="settings-error">{current.error}</output>}
    {current && !current.error && <>
      <p>{current.items.length} registros · Hasta 100 resultados recientes por estado.</p>
      {current.items.length === 0 ? <section className="settings-card"><h2>{status === 'in_review' ? 'No hay revisiones pendientes' : 'No hay contenido en este estado'}</h2><p>Los borradores enviados a revisión aparecerán en Pendientes.</p></section> :
        <ul className="review-list">{current.items.map(item => <li className="settings-card" key={item.id}>
          <div><h2><Link href={'/?draft=' + encodeURIComponent(item.id)}>{item.title || 'Sin título'}</Link></h2>
          <p>Versión {item.revision} · {labels[status]}</p>
          <p>Actualizado: <time dateTime={item.updated_at}>{new Date(item.updated_at).toLocaleString('es', {timeZone: 'America/Lima'})} (Lima)</time></p></div>
          <Link className="review-open" href={'/?draft=' + encodeURIComponent(item.id)}>Abrir contenido →</Link>
        </li>)}</ul>}
    </>}
  </main>;
}
