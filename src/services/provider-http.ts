/** Provider requests never retry writes: an ambiguous timeout may have created a post. */
export async function providerRequest<T>(base: string, path: string, authorization: string, method = 'GET', body?: unknown): Promise<T> {
  const url = new URL(base);
  const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((!localHttp && url.protocol !== 'https:') || url.username || url.password || url.search || url.hash) {
    throw new Error('Provider base URL must be HTTPS (or loopback HTTP) without credentials, query or fragment');
  }
  if (!authorization.trim()) throw new Error('Provider credential is missing');
  const response = await fetch(base.replace(/\/$/, '') + path, {
    method,
    headers: { Authorization: authorization, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`Provider request failed: HTTP ${response.status}`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function providerId(value: string | number): string {
  if (!String(value).trim()) throw new Error('Provider account or record ID is required');
  return encodeURIComponent(String(value));
}
