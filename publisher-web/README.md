# Open Publisher web

Private Sites workbench for shared drafts, channel-specific text, review and
approval, team access, and provider discovery. This checkout is the Site source
repository; legacy publisher adapters remain in the parent repository.

## Run

Use Node 22.13 or newer and `npm ci`. Set local Worker bindings in the ignored
`.dev.vars` file: NOTION_TOKEN, NOTION_DATABASE_ID, POSTLY_API_KEY and
POSTLY_WORKSPACE_ID. The development owner is the Sites local sign-in identity.
Hosted administrator bootstrap requires OPEN_PUBLISHER_OWNER_EMAIL.

Apply generated migrations with:

```
npx wrangler d1 migrations apply DB --local --config wrangler.local.json
npm run dev
```

Run `npx tsc --noEmit` and `npm run build` for compilation. Integration checks in
`scripts/check-*.mjs` require the local server and existing live Notion/Postly
read credentials. They create local draft fixtures; credential fixtures are
revoked or removed. `check-team.mjs` creates and cleans up local role identities.

## Agent access

Create a scoped credential in `/settings`. Configure these outside source control:

- `OPEN_PUBLISHER_URL`: the HTTPS Site origin (loopback HTTP is allowed for development).
- `OPEN_PUBLISHER_TOKEN`: the individual 90-day application token; permissions follow current team membership.
- `OPEN_PUBLISHER_SITES_TOKEN`: the existing Sites API access credential for a private Site. It is sent separately as `OAI-Sites-Authorization` and does not replace the individual application token.

```
node scripts/open-publisher.mjs --help
node scripts/open-publisher.mjs doctor
node scripts/open-publisher-mcp.mjs
```

The stdio entrypoint forwards the hosted `/api/v1/mcp` catalog and calls, so it
exposes the same 21 tools as HTTP MCP, including Notion import/compare/pull/push and
private Typefully drafts. Configure a stdio-capable client to run Node with the
absolute script path and the environment variables above. Keep secrets in the
client's protected environment, never in a committed configuration file.

The CLI accepts JSON on stdin for commands with arguments. For example:

```
printf '%s' '{"id":"DRAFT_ID"}' | node scripts/open-publisher.mjs typefullyStatus
```

No write operation retries automatically. On a revision conflict, read the draft
again and reconcile. An uncertain Typefully attempt must be reconciled externally
before another copy is attempted.

Validation: local stdio → HTTP MCP passed discovery and authenticated
create/read/conflict checks. Production stdio → hosted HTTP MCP also passed
with a valid, temporary read-only application token and the existing Sites API
credential: 14 tools, 47 channels and rejected writes. After revoking the test
token in the UI, production returned `401 invalid_token` as expected.

Installation inside each named ChatGPT/Claude/Codex/Cursor/Hermes client remains
unverified. Chat clients requiring OAuth instead of explicit HTTP headers need
a separately supported connection path; this stdio bridge does not provide OAuth.

## Current limits

Publication, scheduling, media uploads, Notion migration/sync and remaining
provider adapters are under development. Notion and Postly views verify reads,
not write permissions. The provider map includes unconnected providers.

Runtime dependency audit is clean after the September 8 update. Four moderate
audit findings remain in the development-only Drizzle migration tool dependency
chain. No esbuild development server is used. Generated unused shadcn components
have lint findings; application/server code passes targeted lint. Visual and
mobile QA are pending.

Deploy through Sites using `.openai/hosting.json`; keep runtime secrets in Sites.
Do not create a second Site or commit `.dev.vars`, local D1 state or build output.

Postiz inventory uses server-only `POSTIZ_API_BASE_URL` and `POSTIZ_API_KEY`.
For the local Docker installation, use `http://localhost:4007/api/public/v1`.
Hosted Sites requires a reachable HTTPS service; a local Docker install alone
is not reachable from the hosted Worker. `/api/v1/connections` (also exposed by
MCP) verifies the inventory, including disabled accounts and an empty server.
No Postiz publication or account connection is inferred from that read check.

Notion imports preserve the 31 documented Postiz text overrides as independent
`versions.postiz_<channelId>` values. The editor's provider variant selector
edits those independently of `versions.<channelId>` used by the general channel
and Typefully. A missing Postiz override inherits general channel copy, then
shared body. `/api/v1/channels` exposes each key, Notion field and fallback for
agents. Snapshot mapping v3 preserves v1/v2 merge baselines. Publishing-specific
settings, media and bidirectional Notion writes remain separate pending work.

Current destination catalog: 48 channels. Postiz contributes 34 registered
integrations grouped by destination, including separate LinkedIn Page and
Instagram Standalone variants plus Moltbook. `/api/v1/channels` exposes their
exact identifiers in `postizIntegrations`; Sources shows each variant's account
read status separately. Catalog coverage does not imply connected accounts.

## Notion text writeback

`lib/notion-write-plan.ts` builds a minimal text-property update and simulates
reimport before accepting it. It handles X thread continuation, provider-specific
Postiz copy and text size limits. Ambiguous shared aliases, unsupported channel
fields and empty overrides that cannot round-trip are rejected rather than lost.
The write payload never touches status, dates, URLs or publication controls. Edited rich-text
fields become plain text; untouched fields preserve their existing formatting.

Run `node scripts/check-notion-write-plan.mjs` for the offline regression check.
Limits follow https://developers.notion.com/reference/request-limits.
GET `/api/v1/drafts/:id/notion` includes an outbound plan and recent attempt states.
PUT requires the saved draft revision and remoteEditedAt from comparison. It
requires local incorporation/resolution of remote changes, claims a unique active
write for the page, rereads before PATCH, and verifies content after PATCH. The
editor exposes an explicit “Guardar texto en Notion” action; CLI has pushNotion.
Migration 0004 adds the durable attempt journal. Uncertain attempts block further
writes until an administrator reconciles the selected attempt. No automatic retries.
Notion does not offer compare-and-swap in this integration: a fresh read narrows
but cannot eliminate races with edits made directly in Notion. This is explicit
text writeback, not automatic bidirectional sync or a full-schema migration.

`node scripts/check-notion-write-route.mjs` tests actual route SQL with SQLite and
mocked Notion, including unique concurrent claims, stale revisions, timeout locks,
pre-send cancellation and mismatched readback. Transport is separately tested.
Opt-in `OPEN_PUBLISHER_LIVE_NOTION_WRITE=1 node scripts/check-notion-write-live.mjs`
creates one private, source-less CMS fixture through the local dev server. Its
creation receipt is persisted locally to avoid duplicate creates on uncertain results.
Live write/readback passed 2026-09-14 for page
`3dbda243-5b46-81f8-9f8d-facb3b3ea0a9`, attempt
`b4514f45-2ede-4c5c-9b94-be060678aa83`. No social post was created.
This smoke verifies local server → real Notion, not the hosted deployment.
Visual/mobile QA and client-specific MCP setup remain pending.


MCP `publisher_push_notion` reuses the HTTP PUT writeback handler. Call
`publisher_compare_notion` first; use its revision and remoteEditedAt. Resolve
remote changes through `publisher_pull_notion` and compare again if required.
Read-only tokens cannot push. A pending/uncertain attempt must be reconciled;
never retry automatically. The stdio bridge forwards this tool without a second
implementation. The tool is marked as an external, potentially destructive write
because it replaces selected existing text (and its formatting) in Notion.


Recovery is available in the comparison UI, CLI `reconcileNotion` and MCP
`publisher_reconcile_notion` (HTTP PATCH on the existing linked Notion route).
An administrator supplies attemptId, current remoteEditedAt and action `confirm`
or `keep_notion`. The first requires matching text; the second acknowledges the
current remote content without resending. Both leave the local draft and merge
baseline unchanged. Attempts younger than two minutes cannot be closed. This
quiet period exceeds normal bounded network calls, but does not provide a remote
lock or prove that an upstream operation can never complete late. Recompare
before any new send. Test coverage uses SQLite and mocked Notion; production
reconciliation with a real uncertain attempt has not yet been exercised.

## Reddit fields and Notion synchronization

Draft create/update accepts optional `channelSettings`: `reddit_title`, `reddit_subreddit`, `reddit_kind` (`self` / `link`), `reddit_link`, and `reddit_flair`. The editor exposes these under Reddit, General del canal. They use the same revision and approval reset as text. Omitted settings preserve existing values on PATCH for older clients; an explicit empty object clears them. CLI and MCP create/update share this contract.

Notion mapping v4 imports these five properties and merges them independently of text. The explicit Notion write action supports their rich text, select and URL types and clears values using the correct property shape. Existing mapping baselines are retained so upgrading does not reinterpret old snapshots. Missing/mismatched properties block the write with an actionable error. Notion API races and uncertain-write handling remain as described above.

`node scripts/check-channel-settings.mjs` exercises real draft handlers against SQLite migrations, compatibility, clearing, revision checks, Notion mapping and conflicts. `OPEN_PUBLISHER_LIVE_NOTION_WRITE=1 node scripts/check-channel-settings-live.mjs` updates only the existing private CMS fixture, verifies it has no source/channel assignments, and tests local API → actual Notion readback. This does not publish Reddit content. Community permissions, flair existence and publishing remain separate work.

### Vista previa de Reddit

El editor representa publicaciones de texto y enlace con título específico (o título del borrador), comunidad, Markdown, listas y citas. Marca campos incompletos y límites de título/cuerpo. La vista es una simulación: icono de comunidad, flair, medios, miniatura y reglas de comunidad aún no se consultan a Reddit. La cuenta se verifica al abrir la vista mediante `GET /api/v1/connections/reddit`, autenticado con las mismas reglas que el inventario general. Composio ejecuta `REDDIT_GET_REDDIT_USER_ABOUT` (`username: me`, versión `20260826_00`) y solo devuelve el nombre público en el inventario; no expone preferencias, correo, suscripciones ni el perfil completo. Las cuentas suspendidas no se presentan como conectadas. HTML no se ejecuta y las imágenes Markdown se muestran como marcadores sin descargar medios externos.

Para registros de Notion con tipo automático, los medios pueden cambiar el tipo efectivo: seleccionar Texto o Enlace elimina esa ambigüedad. El publicador heredado usa `Reddit Body`, no `Caption`; la vista avisa de activar Personalizar texto y sincronizar si se está heredando texto general.

Verificación: `node scripts/check-reddit-preview.mjs`. Revisa formato texto/enlace, límites Unicode, URL inválida, HTML/URL insegura, representación Markdown y avisos de Notion. Se verificaron ambos formatos en navegador local y el formato texto a 375 px sin desbordamiento horizontal; no equivale a una publicación real ni a paridad visual completa con todos los clientes de Reddit.

### Cobertura de Postiz por variante

Fuentes muestra las 34 variantes del catálogo de referencia, incluidas LinkedIn Page e Instagram Standalone. `GET /api/v1/connections` y `publisher_connections` exponen el mismo objeto `coverage`: active, reconnect, missing, unverified, variants y unknownIdentifiers. Varias cuentas de una variante no aumentan la cobertura de otras. Una lectura fallida mantiene todas sin verificar; una lectura válida vacía las marca sin cuenta. El catálogo no confirma la versión instalada en un servidor remoto, ni la presencia de claves OAuth, permisos o capacidad de publicación.

Las consultas de conexiones pueden limitarse con `GET /api/v1/connections?provider=postly` (postly, postiz, typefully, reddit, gumroad, luma, github o skool). Sin filtro conserva la respuesta agregada. La pantalla consulta cada proveedor por separado y muestra sus resultados progresivamente; un fallo conserva las demás conexiones. Todas las rutas requieren la autenticación existente.

### Bandeja de revisiones

`/reviews` separa Pendientes, Aprobados y Borradores y abre cada contenido en el editor para revisarlo. En escritorio y móvil se accede desde la navegación principal. La lista muestra hasta 100 registros recientes por estado del espacio autenticado. La API acepta `GET /api/v1/drafts?status=in_review` (también draft/approved); MCP `publisher_list_drafts` acepta el argumento opcional `status`. El filtro se aplica en la base de datos antes del límite. La consulta sin filtro conserva su comportamiento anterior.

`TEST_BASE_URL=http://localhost:3001 node scripts/check-review-queue.mjs` verifica por HTTP y MCP: selección por estado, envío, aprobación, invalidación tras editar y rechazo de una revisión antigua. Crea solo un borrador local, sin publicación externa. La interfaz solo muestra acciones de aprobación cuando el rol confirmado es administrator o approver; la API mantiene la validación de permisos.

### Agent connection diagnostics

`doctor` checks configuration, authenticated API access, the channel catalog, MCP initialization and discovery, and a read-only session call. It checks that API and MCP resolve to the same workspace. Exit 0 means those checks passed; exit 1 includes a stage-specific diagnosis. It does not publish, inspect post content, create credentials, or prove client installation. Reports omit credentials and account identities.

Sites native MCP discovery is not yet configured: the Sites connector rejects `include_mcp_connection` because the publication does not declare an MCP server. This is separate from the existing HTTP/stdio endpoint and its two authentication headers. No manifest or authentication changes have been guessed to bypass this requirement.
