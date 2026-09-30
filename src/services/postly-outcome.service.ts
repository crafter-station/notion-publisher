/** Aggregation must not turn a polling deadline into a confirmed publication failure. */
export type PostlyResult = { platform_name: string; status: 'published' | 'failed' | 'pending'; error?: string; external_id?: string; url?: string };
export function summarizePostlyOutcome(results: PostlyResult[], expectedTargets: number) {
  const published = results.filter(result => result.status === 'published').length;
  const failed = results.filter(result => result.status === 'failed').length;
  const pending = results.filter(result => result.status === 'pending').length + Math.max(0, expectedTargets - results.length);
  if (expectedTargets < 1 || results.length > expectedTargets) throw new Error('Invalid Postly result count');
  const counts = `${published}/${expectedTargets} publicados; ${failed} rechazados; ${pending} pendientes.`;
  if (pending > 0) return {
    postly_status: 'In progress' as const, final_status: 'In progress' as const,
    postly_error: counts + ' Postly aún no confirma todos los destinos. Consultar el post existente; no volver a publicar.',
  };
  if (failed > 0) return {
    postly_status: 'Failed' as const, final_status: 'Error' as const,
    postly_error: counts + ' Revisar los destinos rechazados en Postly. No reenviar a los destinos ya publicados.',
  };
  return { postly_status: 'Published' as const, final_status: 'Published (EN)' as const, postly_error: '' };
}
