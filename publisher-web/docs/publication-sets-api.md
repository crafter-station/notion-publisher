# Native publication sets

Workspace-visible organization of account references across providers. These
sets do not create remote groups, grant account access or authorize publication.
Attaching a set to a draft captures its account references as described below. Accounts remain explicitly `not_checked` until a
separate provider verification occurs. Set membership is not an access-control
boundary; workspace permissions apply.

- GET `/api/v1/sets`: 50 sets per page, stable ID order. Pass `nextCursor` as
  `after` until null. GET `/api/v1/sets/{id}` reads one set.
- POST `/api/v1/sets`: `{id,name,accounts}`. Generate and retain a lowercase UUID
  before sending; reuse that ID and identical content after a lost response.
  A conflicting or subsequently edited set returns 409 instead of duplicating it.
- PATCH `/api/v1/sets/{id}`: `{revision,name,accounts}` replaces the name and
  ordered references, increments the revision and rejects stale versions.
- Account shape: `{provider,accountId,sourceGroupId?}`. Exact provider IDs; never
  merge accounts by display name. Duplicate provider/account pairs are rejected.
  Maximum 200 references and 120 characters for the set name.

Administrator/editor writes; approver reads only. Token read/write scopes,
workspace boundaries and browser Origin checks use the existing authentication.
Creation and modification record the acting user. There is no deletion endpoint.

CLI: `sets`, `getSet`, `createSet`, `updateSet`, JSON on stdin.
HTTP MCP and the forwarding stdio bridge expose `publisher_list_sets`,
`publisher_get_set`, `publisher_create_set`, `publisher_update_set`.

Validation: `check-publication-sets.mjs` uses actual authorization and SQLite
migrations. `check-mcp-http.mjs` exercises all four tools on the local HTTP MCP
server with read/write tokens. Provider verification, draft association and the
editor selector are implemented as described below; delivery coverage remains
limited to the implemented adapters.

## Current reference verification

`GET /api/v1/sets/{id}/verify`, MCP `publisher_verify_set`, and CLI `verifySet` inspect the current provider inventories after workspace authorization. Each provider is read once per request. The response identifies the set revision and returns per-reference states: `reference_verified`, `account_missing`, `account_disconnected`, `account_hidden`, `group_missing`, `group_membership_mismatch`, `unsupported_provider`, `missing_configuration`, `subscription_required`, or `read_failed`.

This read-only snapshot does not persist verification, modify the set, or authorize publication. Provider timestamps are retained; references may change after the response. Delivery must recheck permissions and destinations.

## Draft association

Draft POST/PATCH accept `publicationSet: {id, revision}` or `null`. Omission preserves the current snapshot on PATCH; null clears it. The server resolves workspace ownership and captures the set name and account references itself. Client-supplied account data is ignored. GET/list drafts include the stored snapshot. Selecting a stale set revision returns 409. Re-sending the same reference preserves the saved accounts even when the set was edited later; adopting a new revision must be explicit. Draft revision compare-and-swap applies, and any save resets approval. Approvers cannot change this association.

The editor can create sets from provider inventories, select or clear a set, inspect its saved references, verify the current set, and explicitly adopt a newer revision. Typefully private copies are restricted to the saved Typefully accounts when a set is attached. Other delivery adapters must enforce the same boundary when implemented. This feature does not introduce social publishing.
