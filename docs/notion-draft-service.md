# Notion draft service

Dedicated Node entry point for the Notion-first workflow. It exposes only:

- `GET /health`: process readiness (not a provider authentication probe).
- `POST /webhooks/draft-typefully`: create/reuse a private Typefully draft and
  write its private URL and In progress status back to the source Notion page.

Build with `npm ci && npm run build`; start with `npm run start:notion-drafts`.
This entry point does not import legacy publication routes or schedulers.

## Configuration

Required secrets: `NOTION_TOKEN`, `COMPOSIO_API_KEY`, `PUBLISHER_WEBHOOK_TOKEN`.
The webhook token must be a dedicated random value of at least 32 characters;
do not use a provider API key as the webhook credential.

Required identifiers: `NOTION_DATABASE_ID`, `COMPOSIO_USER_ID`,
`COMPOSIO_TYPEFULLY_CONNECTED_ACCOUNT_ID`.

Production requires `NODE_ENV=production` and `TYPEFULLY_JOURNAL_DIRECTORY`
pointing to a mounted persistent volume (for example `/data/typefully-jobs`).
Use exactly one service replica with access to that volume. Preserve receipts
when moving hosts. Without a shared transactional store this implementation
must not run on ephemeral replicas. `PORT` defaults to 3000; `HOST` defaults to
0.0.0.0. Health path is `/health`.

The legacy server also recognizes the endpoint but retains its old schedulers.
Deploy the dedicated entry point for this service.

## Notion database button

After the HTTPS deployment and persistent volume are verified, configure a
button labelled **Crear borrador en Typefully**:

1. Add the `Send webhook` action with the service's HTTPS
   `/webhooks/draft-typefully` URL.
2. Add custom header `Authorization` with `Bearer <PUBLISHER_WEBHOOK_TOKEN>`.
3. Restrict the button workflow to Publisher records intended for Typefully.
   Each record needs Source Tags containing Typefully, selected supported
   Channels, a numeric Typefully Account social-set ID, and its copy.
4. Test on a private fixture. Verify Typefully URL and In progress appear in
   Notion and that the resulting Typefully draft has no scheduled date.

The route accepts Notion's `data.id` page reference or an explicit `page_id`.
It ignores incoming content/properties and fetches the source page from Notion.
The source database, source tag, active provider connection and owner are
validated in the execution path. HTTP success means the receipt was written
back to Notion, not that anything was published.

Notion supports custom headers and POST webhook actions on paid plans:
https://www.notion.com/help/webhook-actions

## Failure handling

- 401: incorrect/missing webhook credential; no job executed.
- 400/413/415: invalid page reference, oversized body or unsupported payload.
- 503: webhook credential is not configured.
- 502: draft not confirmed; inspect Notion and the persisted receipt before
  retrying. Upstream errors and secrets are not included in the response.

A confirmed upstream creation is persisted before Notion writeback. Retrying a
writeback failure reuses that receipt. A pending/uncertain creation is never
retried automatically. Notion can pause a failed automation; review the cause
before resuming it. No content is publicly shared or scheduled by this action.

## Verified scope

The HTTP handler is tested with a real isolated local HTTP listener for auth,
payload limits, malformed/conflicting IDs, method restrictions and redacted
failures. The standalone compiled service was also exercised with real Notion
and Composio credentials against an existing draft receipt. It returned the
same draft and exposed none of the legacy publishing routes. Deployment and
Notion button configuration remain pending.
