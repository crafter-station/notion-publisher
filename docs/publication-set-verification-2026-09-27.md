# Publication set reference verification

Web commit: `588b7f5f0812b8ba760d8dc8155a7674da826eaf`.
Private Sites deployment: `appgdep_6ab9bccae5188191924d5f15cb8a5426`, succeeded at 2026-09-28T01:03:31Z (September 27 in Lima).

GET `/api/v1/sets/{id}/verify`, MCP `publisher_verify_set`, CLI `verifySet` read shared provider inventories after authenticating and loading the workspace-owned set. Each provider is consulted once. Reports unavailable providers separately from missing, hidden or disconnected accounts and missing/mismatched groups. Includes revision and timestamps; never persists verification or authorizes delivery.

Validation: TypeScript, scoped oxlint and production build passed. SQLite fixture exercised real token/workspace checks, no provider reads before authorization, all verification states and unchanged revision. Local HTTP MCP exercised 21 tools including set verification. No social publication or scheduling. Hosted deployment succeeded; authenticated production API behavior was not tested this turn.

Remaining: set UI and draft association, end-to-end delivery authorization, full original goal.
