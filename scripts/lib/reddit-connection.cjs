// Read-only probe of the server's Composio project; never uses the CLI session.
async function checkRedditConnection(env, request = fetch) {
  const result = { source: 'reddit', transport: 'composio', scope: 'authenticated preferences read only; publication not verified' };
  if (!env.COMPOSIO_API_KEY) return { ...result, state: 'missing_configuration', missing: ['COMPOSIO_API_KEY'] };
  const headers = { 'x-api-key': env.COMPOSIO_API_KEY, 'Content-Type': 'application/json' };
  const call = (path, body) => request('https://backend.composio.dev/api/v3.1' + path, {
    headers, method: body ? 'POST' : 'GET', body: body && JSON.stringify(body),
    redirect: 'error', signal: AbortSignal.timeout(20000),
  });
  try {
    const response = await call('/connected_accounts?toolkit_slugs=reddit&limit=100&account_type=ALL');
    if (!response.ok) return { ...result, state: 'failed', httpStatus: response.status };
    const listing = await response.json();
    if (!Array.isArray(listing.items)) return { ...result, state: 'invalid_response' };
    const accounts = listing.items.filter(a => (a.toolkit?.slug || a.toolkit_slug) === 'reddit');
    const configured = env.COMPOSIO_REDDIT_CONNECTED_ACCOUNT_ID || env.COMPOSIO_CONNECTED_ACCOUNT_ID;
    // Never reuse another toolkit account setting, and never guess between accounts.
    const candidates = configured ? accounts.filter(a => a.id === configured) : accounts.filter(a => a.status === 'ACTIVE');
    if (!candidates.length) return { ...result, state: configured ? 'configured_account_unavailable' : 'missing_connection', accountCount: accounts.length };
    if (candidates.length !== 1 || (!configured && listing.next_cursor)) return { ...result, state: 'account_selection_required', missing: ['COMPOSIO_REDDIT_CONNECTED_ACCOUNT_ID'] };
    const account = candidates[0];
    if (account.status !== 'ACTIVE') return { ...result, state: 'connection_inactive' };
    const userId = account.user_id || account.userId || account.entity_id;
    if (env.COMPOSIO_USER_ID && userId !== env.COMPOSIO_USER_ID) return { ...result, state: 'account_owner_mismatch' };
    if (!userId || !account.id) return { ...result, state: 'invalid_response' };
    const execution = await call('/tools/execute/REDDIT_GET_ME_PREFS', {
      user_id: userId, connected_account_id: account.id, version: '20260826_00', arguments: { fields: 'lang' },
    });
    if (!execution.ok) return { ...result, state: 'failed', httpStatus: execution.status };
    const payload = await execution.json();
    const success = payload.successful ?? payload.data?.successful;
    if (success !== true) return { ...result, state: 'tool_failed', httpStatus: execution.status };
    const data = payload.successful === true ? payload.data : payload.data?.data;
    if (!data || typeof data.lang !== 'string') return { ...result, state: 'invalid_response' };
    return { ...result, state: 'read_verified', httpStatus: execution.status };
  } catch {
    return { ...result, state: 'network_or_response_error' };
  }
}
module.exports = { checkRedditConnection };
