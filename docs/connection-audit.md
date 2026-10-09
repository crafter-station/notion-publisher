# Connection audit — 2026-09-08

Evidence command: `node scripts/check-connections.cjs <publisher-env-file>`.
The diagnostic makes read-only requests; it does not start the server, publish,
modify Notion, verify paid subscriptions, or certify write permissions.

## Configuration

This checkout has no `.env`. The existing runtime configuration is in the older
`gumroad-published` checkout. Its `.env` matches the server's `dotenv/config`
loading convention. Do not overlay `.env.local`: that file contains a rejected
Composio credential. The first interactive audit incorrectly overlaid it;
separate requests resolved the discrepancy. No credential rotation is needed
for the valid existing Composio connection.

## Verified results

| Source | Evidence | Remaining work |
|---|---|---|
| Notion | HTTP 200; 165 properties; nine Source Tags | Inventory rows, buttons and field contracts |
| Postly | HTTP 200 on workspace socials | Verify account readiness and per-channel capabilities |
| Gumroad | HTTP 200; success=true on user | Verify publish flow using an agreed fixture |
| Luma | HTTP 200 on get-self | Verify create/update capabilities |
| GitHub | HTTP 200 on user | Verify repository-specific permissions; current writer restricts owner to TheVeller |
| Composio | HTTP 200; Reddit ACTIVE and matches configured account | Eventbrite absent from returned accounts; inspect available auth flow |
| MySkool | HTTP 200 on groups | Existing implementation is read-only; verify upstream write support |
| Typefully | No key in reviewed runtime configuration or central secret service | API v2 client and account connection |
| Postiz | No key in reviewed runtime configuration or central secret service | Identify deployment, client and account connection |
| ONCE | No implemented client | Verify MCP OAuth connection and tool schemas |

TypeScript check: `npx tsc --noEmit` passed before modifications. Diagnostic
syntax check passed and live execution reproduced the table. Exit code 1 is
intentional while any source remains unverified.

## Primary references

- Typefully v2: https://typefully.com/docs/api
- Typefully authentication migration: https://support.typefully.com/en/articles/13133296-typefully-api-v1-v2-migration-guide
- Postiz: https://docs.postiz.com/public-api/introduction
- Postiz account discovery: https://docs.postiz.com/public-api/integrations/list
- ONCE MCP: https://dev.once.app/blog/building-once-mcp-server

## Accepted product direction

User accepted web + mobile, Sites evaluation, administrator/editor/approver
roles, and API/MCP access from ChatGPT, Claude, Codex, Cursor and Hermes where
supported. Desktop is excluded. Keep Notion operational during transition;
eventual native storage owns operational content and synchronizes a team record
to Notion, with explicit field ownership. Remove production dependence on ngrok.

Goal is active in Codex task 01a07eb4-7dec-7760-9733-3eac2bed9c4e. Work branch:
`codex/publisher-web`. Pre-existing modification to package-lock.json is not
part of this audit. No live publication, deployment or database migration has
been performed.

## Next execution

### Follow-up evidence and steering

- User confirms Typefully uses Composio, Postiz is not installed, Eventbrite lacks a key, and authorizes Postiz installation/account setup with browser assistance. API-first UX and agent UX are explicit priorities.
- Composio CLI identity has Typefully + Reddit connected, distinct from the old publisher API-key project (which lists Reddit + GitHub). Do not assume CLI authorization is available to a hosted service.
- `TYPEFULLY_LIST_SOCIAL_SETS` succeeded with limit 50: one social set, ID 33552, TheVeller. Composio schema advertises maximum 100, but live Typefully rejects values above 50.
- `REDDIT_GET_ME_PREFS` with only lang succeeded through the CLI. Publishing is still unverified.
- Added Typefully and Postiz HTTP clients and Typefully operations in ComposioService. Direct Typefully client is optional; the intended path is Composio. Clients are not yet wired into Notion webhooks or the web app.
- Provider contract checks pass; TypeScript compilation passes. Contract tests use mocked HTTP and do not establish live write access.
- Docker Desktop was installed but stopped; started it. Official Postiz compose repository cloned to `/private/tmp/publisher-postiz-compose` for inspection. No containers started yet. Must replace example secrets, bind local setup ports to loopback, and select durable production hosting later.
- Sites initializer package @openai/create-sites@0.3.0 is available. No Site or UI checkout created yet.

1. Inspect actual Notion source usage and Postly account shape without exposing tokens.
2. Resolve connection onboarding for Typefully/Postiz/ONCE/Eventbrite.
3. Reconcile provider capability schemas, build clients and meaningful contract checks.
4. Build Sites workbench with persistent records/media, team authorization and per-channel editing.
5. Implement API/MCP and reliable scheduling, retries, idempotency and Notion sync.
6. Validate workflows and mobile experience; deploy and verify selected audience.

Do not label declared channels as working connections or mark the goal complete
while integrations, production behavior or acceptance checks remain outstanding.

## Open Publisher continuation

User renamed the product to **Open Publisher** and requested mapping Buffer,
Hootsuite and additional user-selected schedulers. Updated local package names,
web branding/metadata, README heading and Sites title. Existing repository path,
remote and Notion DB names remain operational identifiers pending coordinated
migration. Added Buffer/Hootsuite as mapped-only registry entries and documented
provider/account/channel separation in `docs/provider-map.md`.

Sites checkout now exists at `publisher-web/`. Site ID is persisted in
`.openai/hosting.json`: `appgprj_6a9f705d212c81919faf0ab726e4dfc6`.
Do not create a second Site. It remains private/unpublished, version 0.
Initial editor supports local shared text, per-channel overrides and an
orientative preview; no durable save, account auth enforcement or API yet.
Latest local server session 38845 reports http://localhost:3000/ and GET / returned
200. Initial preview opened in Codex. Prior sessions disappeared after runtime
change, so this is a verified replacement, not a duplicate server.

Dependencies installed from official Sites initializer; audit identified
vulnerabilities in pinned starter versions (report at
`/private/tmp/publisher-web-audit.json`). Review/fix before production; do not run
blind force downgrades. Backend TypeScript and registry checks pass with 11
providers including the two newly mapped entries.

## Persistent draft API — 2026-09-08

Implemented D1 members/drafts schema and generated migration
`publisher-web/drizzle/0000_dapper_cannonball.sql`. Applied only to local D1 with
`wrangler.local.json`; no production migration yet. API routes:

- `GET /api/v1/session`: authenticated team role.
- `GET/POST /api/v1/drafts`: team-scoped list/create.
- `GET/PATCH /api/v1/drafts/:id`: read/update with required revision.
- `POST /api/v1/drafts/:id/review`: submit, approve, return; editors cannot approve/return.

Owner bootstrap requires OPEN_PUBLISHER_OWNER_EMAIL in hosted environment.
Development-only bootstrap uses the Sites provided seedy@sites.test identity.
No first-visitor administrator grant. Browser writes require matching Origin.
Draft edits reset approval status and increment revision. Unknown failures return
redacted structured errors. API/MCP tokens, team invitations and management,
production owner configuration, pagination beyond first 100 drafts, and review
UI remain unfinished.

Editor now saves/loads persistent drafts and displays save failures/revisions.
Local sign-in uses the official Sites route and cookie. No fake session headers.
`publisher-web/scripts/check-drafts.mjs` passes authenticated create/read/update,
per-channel overrides, stale revision conflict, anonymous denial, cross-origin
denial, invalid input and review transition checks. Local test fixtures retained.
TypeScript and targeted lint of app/API/server/schema pass. Full starter lint
still reports issues in generated, unused UI components; resolve before final QA.
Local server handle remains 38845 at http://localhost:3000/.

## Team, agent access and review UI — 2026-09-08

Migration `0001_huge_nighthawk.sql` is generated and applied locally. Team
administrators can authorize editor/approver emails and withdraw access; the
application does not send emails. Sites access must separately allow visitors.
Personal API credentials expire after 90 days, are stored as SHA-256 hashes,
shown once, and can be revoked. Every token request resolves current membership
and role; read-only tokens cannot mutate. Tokens cannot administer members or
credentials. Browser administration remains authenticated and Origin checked.

The stdio MCP client exposes six draft/session/review operations through the
same HTTP API as the CLI and web interface. SDK client tests verify discovery,
authenticated create/read, and actionable revision conflicts. Remote MCP and
hosted bearer access are not yet verified. Do not claim chat compatibility from
stdio tests alone.

Editor controls now include new drafts, submit/approve/return transitions,
mobile draft navigation and settings access. Team settings support credential
issuance/revocation and member access removal. API request bodies are bounded to
one million bytes while streaming before decoding, with an oversized UTF-8
request rejection check. TypeScript and targeted application lint pass; draft,
review, token and MCP checks pass. Visual/mobile interaction QA remains open.

Sites access re-read: owner-only, one allowed user, no external visitors or
groups, version zero and no live URL. Native MCP connection discovery reports
that publication is required before connection details are available. This is
platform evidence, not confirmation that our MCP endpoint is implemented.


## Live Notion inventory in the web application — 2026-09-08

Completed full read-only traversal of the current database: 241 distinct rows
across three pages, 165 properties, 101 properties populated. Source counts:
Postly 64, Gumroad 163, Luma 7, GitHub 5, Composio 2. No current rows tagged
Typefully, Postiz, ONCE or Skool. Source counts describe usage, not connectivity.
Status counts: Not started 170, Published 9, Published (EN) 20, Error 42. Existing
errors require provider-specific investigation; they are not resolved by import.
`docs/notion-schema-audit.json` records names/types/aggregate counts only, without
page IDs, contents or credentials. `scripts/inventory-notion.cjs` reproduces it.

Added authenticated `GET /api/v1/notion?cursor=...` and `/sources` UI. This reads
actual Notion schema and records in pages of 50, exposes source/channel labels,
provides Notion links and a field inventory. It does not import or publish yet.
Local Worker gets only Notion token/database bindings in ignored `.dev.vars`
(mode 0600). Hosted environment remains unconfigured. During live validation,
workerd rejected redirect:error; switched to redirect:manual with non-2xx
rejection so credentials are never forwarded through redirects.

The current development server is session 25395 at http://localhost:3000/,
replacing the deliberately stopped session 38845 to load Worker bindings.

Live web check now passes: authenticated Notion schema/records, following the
server-returned opaque pagination cursor, oversized cursor rejection and
anonymous denial. Do not constrain cursors to UUID format: live API returns an
opaque cursor. No contents copied into native storage by this check.

## Live Postly account discovery and agent parity — 2026-09-08

The Postly socials response contains 34 objects: 32 actual social accounts and
2 audience groups. All 32 accounts currently have connected=true. Groups carry
audience_group_id and channel_ids, not target/connected; they must not be
counted as disconnected accounts or sent alongside their children by default.
The two current groups contain eight and nine destinations respectively.

Added `GET /api/v1/connections`, Sources UI account/group lists, CLI `connections`
and MCP `publisher_list_connections`. The same authenticated inventory supports
read-only agent credentials. Only allowlisted account/group fields are returned;
provider credentials and author/workspace objects stay server-side. Seven MCP
tools now exist. Live connection checks verify 32 accounts/2 groups, safe fields,
anonymous denial and read-only agent access. MCP discovery and draft tests pass.
This verifies discovery, not posting permissions or publication success.

Queried all 42 Notion Error rows: 41 tagged Postly, one Composio. None has text
in Postly Error. The original failure cannot be diagnosed from that field alone;
inspect per-provider history/status before considering a retry. No retry or
publication was performed.

Local Worker Postly bindings added to ignored `.dev.vars`; production bindings
are not yet configured. Current dev server session 50997 replaces deliberately
stopped session 25395 to load bindings. Docker client 27.5.1 reports it cannot
connect to the desktop-linux daemon. Both Docker app path and bundle-id CUA
launch attempts time out; Postiz has not been started or connected.

Member removal now revokes matching non-administrator API tokens in the same
D1 batch as membership/invitation deletion. Rejoining must not resurrect tokens
issued before removal. `scripts/check-team.mjs` seeds separate local-only editor
and approver identities to exercise actual API role checks, then removes only
its generated identity/token fixtures. Its created draft is retained.

## First private deployment — 2026-09-09 UTC

Site version 1 deployed successfully at
https://publisher-crafter-station.theveller.chatgpt.site . Access remains
owner-only. Source checkout `publisher-web/` now has its own Git repository as
required by Sites; parent repository still contains legacy adapters and audit
notes. Source commit: 232b871e146d625b9e9773813ab8fdeaa1e814ec. Deployment:
appgdep_6aa0b92e2ce08191b568f733197bc64e. Saved version:
appgprj_6a9f705d212c81919faf0ab726e4dfc6~appgver_82e1d345eb2c81918119700618200582.
Initial save returned an internal error; version listing verified no save before
one successful retry. Production uses runtime environment revision 1, with
owner email and Notion/Postly credentials configured as secrets.

Updated React/RSC to 19.2.8, vinext beta.9, Vite 8.2.2, Cloudflare Vite plugin
1.54.6, Wrangler 4.130.0, RSC plugin 0.5.34 and compatible Workers types. Build
and TypeScript pass. Production dependency audit reports zero vulnerabilities;
four moderate development-only Drizzle dependency findings remain. No forced
peer dependency overrides used. Local draft/role/revocation/Notion/Postly/MCP
regression checks all pass after updates. Build and staged-source scans found
no configured runtime secret values. Generated unused shadcn lint findings
remain documented in the web README.

Hosted API probes through the Sites dispatch bypass reach app code but correctly
return authentication_required: dispatch bypass does not supply a signed-in
user. Therefore production signed-in persistence/provider reads remain
unverified; deployment success must not be called complete product validation.
Native MCP discovery reports that the deployed Site does not declare an MCP
server. Remote MCP remains unfinished; do not claim stdio as remote chat support.
Existing Codex browser tab was reused for the deployed URL (UI handoff queued).

Sites database inspection confirms production DB tables api_tokens, drafts,
invitations and members exist. Local dev session 23718 was deliberately stopped
after deployment; start a new retained server for further local integration
work rather than assuming this handle remains live.

## Signed-in production verification — 2026-09-09 UTC

Used the existing Sites browser tab and its real signed-in session. Created the
private fixture "Verificación de Open Publisher", saved it (revision 1),
submitted it for review (revision 2), returned it to draft and reopened it from
the draft selector (revision 3). Reopened title/body matched the entered text.
No content was published to any provider. The fixture remains as a private draft.

Production Sources UI loaded 165 Notion fields and 50 records with another page
available. Postly subsequently displayed 32 connected accounts and two groups
with eight/nine destinations. This closes the earlier signed-in persistence and
provider-read verification gap for the owner. Team external-user sign-in and
remote MCP are still unverified/unfinished.

Observed UX fixes to make next: initial empty editor incorrectly reports unsaved
changes; loading a draft displays "Guardando"; initial session fetch briefly
shows sign-in before authenticated state arrives. Sources should display an
explicit loading state for provider discovery. These are observed behavior,
not blockers to the successful production read/save test.

## Existing provider identities in web/API/MCP — 2026-09-09 UTC

Expanded /api/v1/connections with isolated read checks for Gumroad, Luma, GitHub
and MySkool alongside Postly. Provider requests run concurrently and failures
are represented per provider. Returned identity fields are allowlisted; email,
bio, profile links, credentials and raw errors are excluded. Each identity
marks read verification, explicitly not write readiness. MySkool discovers
groups and still has no publication implementation.

The live local integration check now requires all five implemented discovery
providers to succeed and return accounts, while verifying Postly group separation
and read-only token access. TypeScript, targeted lint and production build pass.
Configured corresponding hosted secret bindings in environment revision 2.
Also fixed initial dirty state, transient sign-in display, draft-loading text,
editing during draft loading and missing provider-loading feedback. Build output
scan found no configured secret values.

Site source commit abd62b340c0e2c5dc52b80acfed0eb1955a386d3 is pushed. Saved
version 2 is appgprj_6a9f705d212c81919faf0ab726e4dfc6~appgver_e0446229a7f08191b72567f78a9c06e2.
Deployment handle appgdep_6aa0bb14c6548191a1f003bf9e81a67a was dispatched privately.

Version 2 deployment succeeded using runtime environment revision 2. Real
signed-in browser verification shows identity read success for Gumroad, Luma,
GitHub and MySkool in production. The provider-loading message is visible while
fetching. Existing Site tab retained as deliverable. Local server session 79368
was stopped after validation.

## Streamable HTTP MCP implementation — 2026-09-09

Added `/api/v1/mcp` using the official SDK Web Standards transport with stateless
JSON responses. Seven tools invoke the existing API route handlers in-process,
retaining their membership, token scopes, role checks, input validation and
optimistic revisions. All MCP envelopes require authentication; supplied Origin
must match the server. Browser writes still require matching Origin in the API.
Bounded request parsing applies before protocol handling. No internal HTTP hop,
write retry or publication is introduced.

Official StreamableHTTPClientTransport checks pass locally: initialization, tool
listing, authenticated session, read token write denial, write-token draft
create/read, stale revision conflict, anonymous denial and cross-origin denial.
Temporary tokens are revoked; unpublished local draft fixture retained.
TypeScript and targeted lint pass. This endpoint is not yet deployed or wired to
Sites native MCP declaration/OAuth. The existing owner-only dispatcher remains
a separate gate for external clients. Do not claim ChatGPT/Claude remote access
from these local protocol checks. Local development server handle is 54992.


## Priority correction from user — 2026-09-09

User explicitly directs finishing the usable Notion system before migrating the
full functionality into Open Publisher. Web UI defaults must be dark, cover all
original channel/category divisions, validate provider API fields and use
platform-specific previews. Generic current preview rejected as insufficient.
Recorded in provider-map.md. Existing code/production Site are preserved; HTTP
MCP work remains local and unfinished, not a reason to defer Notion completion.

Rechecked server routes: Gumroad/Postly/Luma/GitHub/Composio have publishing
handlers; Typefully, Postiz, ONCE have none. MySkool has read integration only.
Priority next is complete Notion provider use cases and writebacks, reconcile
Composio's Typefully runtime identity, then resolve external authentication
blocks. Source counts and connection read checks are not publish acceptance.

## Notion-first Typefully mapping — 2026-09-09

Re-read the live Composio TYPEFULLY_CREATE_DRAFT schema (catalog version
20260908_00). Its platforms object uses x/linkedin/threads/bluesky/mastodon,
enabled=true and posts arrays. Four newlines delimit posts; publish_at controls
actual publishing and is excluded from our draft payload.

Added pure Notion field conversion with explicit numeric social-set selection,
Caption fallbacks, existing channel overrides, X/Twitter alias deduplication and
Typefully Thread continuation. Rejects unsupported selected channels, existing
Typefully URL, missing content and media until a real upload path is implemented.
Tests pass for these cases; this is mapping validation, not live draft creation.
Read-only preview command validates the page belongs to the configured Publisher
DB and prints the prepared draft without contacting Typefully or writing Notion:
`node scripts/preview-typefully-notion.cjs ENV_FILE NOTION_PAGE_ID`.

Remaining: Typefully execution using the correct Composio project identity,
idempotent result persistence and Notion writeback, then button setup. No
Typefully draft or Notion mutation has been performed in this step.

## Server Typefully connection diagnosis — 2026-09-09

The connection checker now tests Typefully through the configured Composio
project, rather than requiring a direct Typefully API key. It uses an explicit
COMPOSIO_TYPEFULLY_CONNECTED_ACCOUNT_ID when configured, never borrows the
Reddit account ID and refuses ambiguous account selection. A verified read
requires a successful TYPEFULLY_LIST_SOCIAL_SETS tool result. Error output
omits credentials and upstream bodies. The Typefully toolkit pin is now
20260908_00, matching the inspected catalog.

Live rerun: Notion, Postly, Gumroad, Luma, GitHub, Composio and MySkool reads
succeed. Server Composio project contains no Typefully account. Separately,
consumer CLI successfully reads social set 33552 (TheVeller). These are distinct
runtime connections; the CLI result does not enable the server or hosted app.
Postiz configuration and ONCE OAuth remain unverified. Check exits 1 as intended
for incomplete connections. Contract tests and TypeScript validation pass.

## Live Notion → Typefully draft → Notion — 2026-09-09

Added isolated draft use case and explicit local Composio CLI command (no server
or schedulers imported). Single-host filesystem reservations prevent concurrent
creates and automatic retries after uncertain outcomes. Confirmed receipts are
persisted before Notion writeback; retries after Notion failures reuse the same
draft. Foreign database pages, archived pages, wrong source tags, mismatched
existing links and invalid/non-draft provider responses are rejected.

Real fixture: Notion page 3d6da243-5b46-81a6-8c16-cfea2a16979e, titled
[Prueba privada] Open Publisher → Typefully. Social set 33552; draft 10690024;
private editor https://typefully.com/?d=10690024&a=33552. No publish_at or public
share requested. Notion readback confirmed In progress and the exact private
URL. Second command invocation returned reused=true and the same draft ID.

Meaningful checks pass for writeback recovery, uncertain writes, concurrent
requests, replay, source/database boundaries and result validation. TypeScript
passes. This does not enable a Notion button, server identity, scheduling, media,
cloud execution or other channels. Keep these requirements open.

Independent TYPEFULLY_GET_DRAFT read verified exact fixture text, status=draft,
scheduled_date=null, published_at=null, share_url=null and only X enabled.

## Typefully server Composio connection and live API draft — 2026-09-09

Resolved the runtime identity gap. Created a dedicated Typefully key labelled
Open Publisher — Composio server through the authenticated Typefully UI and
entered it into Composio's hosted connection form without logging its value.
Existing Rube/CLI key was preserved. Auth config ac_VONC7Yq4pmXz; connected
account ca_fdN9UxitVFBW; expected server user notion-publisher. Account is ACTIVE.
The actual runtime env now selects COMPOSIO_TYPEFULLY_CONNECTED_ACCOUNT_ID;
provider credential stays in Composio. The checker successfully executes the
social-set listing through the server project.

Added --create-draft-via-api transport. It validates the exact connection's
owner, toolkit and active state before reserving a job. Composio service no
longer imports application boot configuration; requests have a 20-second
deadline and reject redirects. The explicit draft payload excludes scheduling.

Real API fixture: Notion page 3d6da243-5b46-8169-8dee-ebb512574f3b;
Typefully draft 10695173; https://typefully.com/?d=10695173&a=33552.
Created through the server project's API credentials, not the CLI session.
Independent API readback verifies draft status, no scheduled date, no publication,
no public share URL. Notion readback verifies the private URL and In progress.
Reusing the prior CLI fixture through API mode also returned the existing receipt.
API contract tests, workflow failure/concurrency tests and TypeScript pass.

Still pending: authenticated HTTP handler, Notion button wiring, durable hosted
execution and media/scheduling/platform-specific completion. This connection
and local API verification alone do not deploy or enable the full team workflow.

## Authenticated Notion webhook and standalone service — 2026-09-09

Implemented POST /webhooks/draft-typefully with dedicated bearer authentication,
JSON/size/deadline validation, page-reference conflict checks, no client content
trust and redacted errors. Added shared Typefully Notion runtime and a standalone
entry point (npm run start:notion-drafts) that exposes health plus this webhook,
without importing legacy publication routes or schedulers. Production requires
an explicit persistent journal directory. Deployment/button instructions are in
notion-draft-service.md.

HTTP contract checks pass. Compiled standalone process was started locally with
only its required runtime credentials, then verified: health 200, legacy Postly
route 404, unauthenticated draft request 401, authenticated Notion-shaped request
200 with reused receipt for draft 10695173. Process stopped cleanly. TypeScript
build and diff whitespace checks pass. No new public publication performed.

Railway discovery: authenticated CLI is admin@nucleo.la, workspace Núcleo
6a363add-40ab-44cf-be94-e07424b3dde8, with no Publisher project. Asked the user
whether this backend should be hosted/billed there or in another account. No
Railway resources or deployments created; account choice remains pending.

## Postly error diagnosis and pending-state correction — 2026-09-09

Fresh Notion read found 41 Postly rows with aggregate Error and Postly Failed:
34 retain a published URL, 31 have pending destinations in Post ID, 8 include
explicit ERR entries, and all 41 had empty Postly Error. These sets overlap.
This is evidence from historical records, not current upstream reconciliation.

Annotated only the empty Postly Error fields in those 41 rows with a concise
historical-record diagnosis and instruction to inspect the existing post before
retrying. Each row was re-read before patching and skipped if edited; zero skips.
Patch responses verified the exact diagnostic. Statuses, URLs and content were
not changed. No Postly publication endpoint was called.

Code fix: polling deadlines/missing results remain In progress; Failed/Error
requires resolved rejection and no pending destinations. Mixed published/pending
results retain a count summary in Postly Error; fully successful outcomes clear
it. Exceptions after submission indicate uncertainty rather than confirmed failure.
Creation prefers the returned internal ID, records it before polling, and final
fallback matches that same internal ID. Final Post ID retains the internal ID.
A failed initial Notion status write prevents any publication; failed final
writeback no longer reports the pipeline as completed.

Tests cover pending, partial, failed and missing outcomes, metadata diagnostics
and clearing, plus the real use-case preflight ensuring zero publication calls
when Notion rejects its initial write. TypeScript passes. These code changes
are not yet deployed; historical upstream statuses still need reconciliation.


### 2026-09-11 — Typefully account inventory in the web backend

- Composio account identity, owner and toolkit validation passed for the configured Typefully connection.
- `TYPEFULLY_LIST_SOCIAL_SETS` and `TYPEFULLY_GET_SOCIAL_SET`, pinned to `20260908_00`, returned social set 33552 and six platform accounts: x, linkedin, threads, bluesky, mastodon, substack.
- Local web `/api/v1/connections` verified all six accounts through the new Worker-compatible adapter. Only account names, IDs, channel and read status are returned; credentials stay server-side.
- Substack added to the shared web/API catalog, bringing it to 47 destinations (35 Social, 2 Events, 3 Products, 7 Music/podcast). Publishing support remains separately unverified.
- Sites configuration now includes the scoped Composio connection reference and secret API key. Production verified in the signed-in Sites browser: six Typefully accounts and read_verified status are visible.

### 2026-09-11 — MySkool subscription blocker

- Fresh production inventory and a direct read both returned HTTP 402. The provider response identifies payment_required and no active subscription.
- The web adapter now distinguishes subscription_required from a generic connection failure, returns no discovered accounts, and directs the owner to MySkool billing. No subscription or billing setting was changed.
- Validation: production build and catalog checks pass. The full live connection smoke check did not pass because MySkool timed out in the local Worker; the other five providers returned read_verified. This does not invalidate the separately observed production/direct HTTP 402, and no timeout is presented as a verified subscription response.

### 2026-09-11 — Web thread authoring

- X, Threads, Bluesky and Mastodon now expose per-post editing, add/remove/reorder and ordered text previews. Edits create a channel-specific version without changing shared content.
- Existing string storage is retained with the four-newline separator used by the legacy Typefully adapter. The editor preserves empty intermediate blocks; they are visibly marked incomplete.
- GET /api/v1/channels (and its MCP wrapper) exposes authoring flags and storage metadata. Media, native visual fidelity and publishing remain explicitly false for this web feature.
- TypeScript, build and the thread round-trip check passed. Local browser verified creating two posts, reversing them and displaying that exact order in preview. No external draft or social publication was created.

### 2026-09-12 — Hosted Typefully private drafts

- Native draft export endpoint and editor support selecting a verified Typefully social set and text channels through Composio. No publish time or public sharing is sent.
- D1 creation claims allow one external copy per native draft/social set. Concurrent requests and later retries cannot create duplicates; uncertain attempts remain blocked for reconciliation. Later native revisions do not update the external copy.
- Linked Notion records are re-read before export: changed records require comparison, existing Typefully links prevent duplicates, and files prevent incomplete text-only export. No Notion writeback is implemented in this path.
- One authorized private smoke draft was created: native local 7049c5fd-c073-49a8-9ddf-84302d773733, Typefully 10736999, https://typefully.com/?d=10736999&a=33552. Concurrent responses were 409 and 201; retry returned the same receipt, status draft.
- Payload/receipt validation, TypeScript, targeted lint, local API scope tests and 14-tool HTTP MCP checks passed. Browser confirmed the saved external link in the editor. Sites deployment succeeded with the D1 migration. The real private creation was exercised through the local Worker; production creation has not yet been independently smoke-tested.

### 2026-09-12 — Production editor → Typefully verified

- In the signed-in owner Sites tab, created and saved `[Prueba privada Sites] Typefully 2026-09-12`, selected the verified Typefully social set and X, then used Crear borrador privado.
- Production returned the private draft receipt 10737048: https://typefully.com/?d=10737048&a=33552. The editor confirmed it was neither scheduled nor published.
- Reloaded the Site and reopened the same native draft through the saved-draft selector. Its version-1 receipt persisted and returned the exact same external URL. No second create was performed.
- This verifies the deployed Worker, production D1 migration, Composio credentials and UI creation/receipt flow for X text. It does not verify other destination formats, media, scheduling, updates or public publishing.

### 2026-09-13 — External agent transport

- Private Sites rejects an application bearer token at its sign-in gate with HTML 401. Reusing the already-existing Sites API credential in OAI-Sites-Authorization reaches the application: a deliberately invalid application token then receives JSON invalid_token. No Site token was generated or rotated, and access remained private.
- The stdio bridge now forwards the hosted MCP catalog and calls (14 tools), removing its stale separate seven-tool catalog. CLI actions also cover Notion and private Typefully operations. Both transports support separate Sites/application credentials.
- Tests passed for separate headers, cross-origin rejection, redirect refusal, non-JSON failures and stdio → HTTP authenticated discovery/create/read/conflicts. The local development test used port 3001 because port 3000 belonged to another listener.
- Terminal code and documentation committed/pushed in the Site source repository. Website bundle unchanged; no new web deployment was required for these standalone client scripts. Full production authentication with a valid individual token and installation in each named chat client remain pending.

### 2026-09-13 — Production MCP authentication and revocation

- Created one temporary read-only application credential in the production settings UI, used it with the pre-existing Sites API credential, then revoked it in the same UI. No Sites credential was rotated and access remained owner-private.
- Real stdio → production HTTP MCP connected successfully, listed 14 tools, read the 47-channel catalog and rejected publisher_create_draft with token_read_only. No draft was created by this denial test.
- After UI revocation, the same application credential received HTTP 401 invalid_token from production. Temporary secrets were not saved to repository files.
- This proves the remote transport/authentication path, not installation or OAuth compatibility in every named client.

### 2026-09-13 — Notion conflict decisions deployed

Hosted version 13 adds explicit Editor/Notion choices per conflicting field to UI and MCP. Each decision requires the compared remote edit timestamp and draft revision; server re-reads Notion and rejects stale comparisons. Unit merge/projection/resolution cases and live HTTP pull checks passed, with no Notion writes. TypeScript, targeted lint and production build passed. Deployment succeeded with existing private access. This is pull/reconciliation, not bidirectional sync.

### 2026-09-13 — Postiz Docker setup

Docker Engine 29.7.2 available, arm64, 10 vCPUs and ~8 GB allocated. Official compose cloned outside the vault to `~/.local/share/open-publisher/postiz`; project and container names isolated, UI bound to loopback, persistent volumes and random local database/JWT secrets configured. Images downloading; service readiness and authenticated inventory not yet verified. See [local operations](postiz-local.md). Canonical provider environment contains no native Postiz or provider app credentials. Existing Composio authorization does not establish a Postiz account connection.

Hosted version 14 now includes a real Postiz inventory adapter in `/api/v1/connections`, the Sources interface and the existing MCP connections tool. Both server URL and API key are required; no fabricated connected state. Verified URL constraints, auth failures, empty/disabled accounts, malformed responses and error redaction; local authenticated HTTP endpoint includes Postiz with missing configuration. TypeScript and production build passed; private deployment succeeded. Hosted connectivity to Docker and authenticated Postiz accounts remain pending.

### 2026-09-14 — Postiz boot verified

The installation process handle ended; Docker confirms Postiz and all critical dependencies running with healthy checks. Anonymous GET `/api/public/v1/integrations` returns 401 (authentication required), and the browser displays the first-account registration form. No account was created: registration explicitly accepts Postiz terms, so the form was handed to the user. Temporal UI was still Created; started successfully. Disk now has ~13 GiB free. Authenticated inventory, social accounts, hosted connectivity and publication remain unverified.

### 2026-09-14 — Full Postiz catalog published

Hosted version 16 deployed successfully with 48 destinations and exact metadata for the 34 providers registered in the installed Postiz image. Added Moltbook and the Postiz route for Skool; LinkedIn Page and Instagram Standalone are represented separately within their destination. Authenticated local `/api/v1/channels` output was checked against `docs/postiz-channel-inventory.json`: all 34 identifiers present exactly once. Sources displays per-variant account read status. This verifies catalog representation, not account authorization or publication. Postiz browser still shows registration; no terms were accepted and no account was created.


## Agent connection instructions — 2026-09-14

Settings now offers stdio, Streamable HTTP and CLI instructions, copying placeholders only. Explains distinct application/Sites credentials, absolute local script path and Node requirement. Explicitly keeps client-specific installation and OAuth-only chats unverified. TypeScript, targeted lint, existing agent-client authentication checks and production build passed. Site version 17 deployed successfully from bd791e62edb13b2e19decd1b41fd139d1f19bb59 (deployment appgdep_6aa80f7e3408819186efe11b6f090be9). No new agent credential was issued; no channel was connected by this change. Visual/mobile interaction validation remains pending.


## Hosted Notion writeback — 2026-09-14

Site version 18 deployed successfully from 67c333312e24031603f26ce7ccdcce2f7e38e388; deployment appgdep_6aa8777a53408191bc3ac4fc508c28ce. Through the authenticated production UI, imported existing private fixture 3dbda243-5b46-81f8-9f8d-facb3b3ea0a9, compared it successfully (exercising notion_writes migration), changed only its title to “[Private smoke] Open Publisher Notion roundtrip · hosted”, saved locally, compared, verified outbound field Name, and clicked Guardar texto en Notion. UI returned “Texto guardado y verificado en Notion.” Server confirmation includes live readback. No social posts or source/channel assignments were made. Browser tab 4 retained as deliverable.

Outstanding: /sources CMS description still says editor changes are not sent to Notion and needs updating; MCP push tool is not exposed yet (CLI pushNotion and HTTP PUT exist). Uncertain-write reconciliation needs an admin flow. Automatic/bidirectional full-schema sync and mobile QA are not complete.


## Notion MCP writeback — 2026-09-14

Version 19 deployed successfully: commit f73a4cb43574d6436e7c2ded441a955d211a0205, deployment appgdep_6aa878a82b908191955ee88281b700d8. publisher_push_notion is the fifteenth tool and reuses the existing PUT handler. Comparison describes outbound fields and attempts. HTTP and stdio SDK tests against local server verified discovery, required input schema, read-token denial and missing-link rejection; existing authenticated draft CRUD/conflict tests passed. No new external Notion writes in these MCP tests. TypeScript, targeted lint and production build passed. Sources CMS text corrected. Client-specific installation and hosted MCP write smoke still pending; prior hosted UI writeback evidence remains applicable to the shared handler.


## Notion uncertain-write recovery — 2026-09-16

Version 20 deployed successfully from d3c6487af7f14dbd506cfc422145f3f3c8bbab34, deployment appgdep_6aaace32bb948191bee68e70dbddca0d. Administrator-only PATCH closes a selected attempt after rereading the compared remote version and enforcing a two-minute quiet period. confirm requires matching attempted text; keep_notion records an explicit decision to retain the current remote content and cancels the attempt. Neither rewrites Notion nor changes the local draft/baseline. UI, CLI reconcileNotion and MCP publisher_reconcile_notion share this handler (16 MCP tools). SQLite tests cover roles, quiet period, stale remote versions, mismatches, both closure outcomes, repeat closure and unchanged draft. HTTP MCP/stdio tests, types, lint and build passed. Recovery of a genuine uncertain write in hosted production remains unverified; do not create a fake production failure just to assert success.


## Mobile editor refinement — 2026-09-16

Version 21 deployed successfully from d47f9b0ed060ffc1af0e6985e041f96569ad4acd; deployment appgdep_6aaae55afc748191a236af09846282df. Compact mobile header/navigation/heading, sticky save bar, 44px minimum editor buttons and collapsible channel-route details. Existing dark design preserved. Local browser at 390×844: title begins at y548, text input at y754; no horizontal overflow. Editor and Settings at 320px also had scrollWidth equal innerWidth. Opened route disclosure and changed Settings transport successfully. Viewport override reset after checks. TypeScript, lint, Impeccable detector and production build passed. Physical phone touch/keyboard, other routes and full breakpoint matrix still need QA.

## Reddit revalidated — 2026-09-16

Composio project read returned one ACTIVE Reddit account. `REDDIT_GET_ME_PREFS`, version `20260826_00`, arguments `{fields: "lang"}`, returned HTTP 200, successful=true and a string language field. No preferences, posts, comments or subscriptions were modified. The reusable `scripts/lib/reddit-connection.cjs` checks toolkit, account selection, owner when configured, inactive accounts, pagination ambiguity and the authenticated response shape; regression checks pass via `node scripts/check-reddit-connection.cjs`. The root connection diagnostic now includes this probe. This is authenticated-read evidence only; Reddit publication and hosted UI wiring remain pending.

The same run verified Notion schema reads (165 properties), Postly, Gumroad, Luma, GitHub and Typefully reads. MySkool returned HTTP 402; Postiz lacks an API key; ONCE OAuth remains unverified. Postiz UI still shows registration; an asynchronous request asks the owner to complete the administrator account without sharing their password.

## Reddit web integration — 2026-09-17

Web source `0f0c39f57ca9c02edbfc7d9dea9434b0e8e8021c` adds Reddit via Composio to `/api/v1/connections` and Fuentes, so the Reddit channel can show its verified account. The server scopes selection to `COMPOSIO_USER_ID`, refuses ambiguous/paginated selection, and requires an authenticated `REDDIT_GET_ME_PREFS` response with string `lang`. No preferences are exposed and no publication is attempted. Actual module executed against the configured Composio project: read_verified, one Reddit account. Regression tests, TypeScript and scoped lint passed; production build succeeded. Full repository lint reports existing findings in shared UI components, the stdio MCP SDK deprecated Server usage and two old sorting tests; those were not changed here.

## Reddit settings in web, API and MCP — 2026-09-17

Web source 4378f3c249372814b0005b52e4739828ad8b9ff2 adds native channel_settings via migration 0005. Editor/API/MCP handle reddit_title, reddit_subreddit, reddit_kind, reddit_link and reddit_flair. Omitted PATCH settings preserve values for old clients; explicit {} clears. Notion mapping v4 imports these fields, three-way merges them, and writes rich_text/select/url with the existing claim/readback/uncertain journal.

Evidence: SQLite route tests, mapping/write/reconciliation regressions, TypeScript and scoped lint passed. HTTP and stdio MCP saved/read settings successfully. The HTTP test needed Connection: close on deliberately rejected requests to avoid a later empty 400 in local keep-alive cleanup; all leftover temporary tokens from these runs were revoked. Real local-server→Notion roundtrip passed on existing private sourceless fixture 3dbda243-5b46-81f8-9f8d-facb3b3ea0a9, now storing Reddit title Private Reddit settings roundtrip, community test, kind self, link https://example.com/. No Reddit posts. UI saved/reopened local fixture Prueba local de campos Reddit with title/community/type intact. At 320px document width stayed 320px; viewport reset. Actual phones and hosted writeback for these new typed fields remain unverified.

## Revalidation — 2026-10-09

Read-only checks from the review worktree used the existing `gumroad-published/.env` runtime configuration, without overlaying `.env.local`. No provider writes, scheduler starts or credential changes occurred.

- Notion: HTTP 200, 167 properties and nine source tags.
- Postly, Gumroad, GitHub and MySkool: HTTP 200 on their existing read probes.
- Composio: HTTP 200; Typefully, Reddit and GitHub accounts reported ACTIVE. Typefully social-set and Reddit authenticated-preference calls independently passed.
- Luma: HTTP 401 on get-self. The configured credential is not accepted by that endpoint; previously recorded success is historical, not current evidence.
- Postiz: no key in this runtime file. The separate local installation has all eight containers exited, its API is unreachable, and its image still matches the checked-in 34-integration inventory. All 34 remain unverified in this check; this is not evidence of zero configured accounts. No containers were restarted.
- ONCE: OAuth/tool access remains unverified.

The initial check against a nonexistent `.env` in the newer repository incorrectly produced per-provider missing-configuration results. `check-connections.cjs` now exits with code 2 and `configuration_file_not_found` for an explicitly supplied missing file, before any provider request. The default process-environment mode remains supported. Regression check: `node scripts/check-connection-config.cjs` passed, including credential/path redaction.

These probes establish reads only. They do not establish hosted connectivity, write permissions, subscriptions, complete pagination, publishing or token renewal. Next integration work must resolve Luma authentication and restore/verify the separately configured Postiz runtime, while retaining the full channel acceptance scope.
