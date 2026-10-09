# Native publication sets: implementation evidence

Source `456c509024a02bf5b5ac35f46ab71f2e756814da` (publisher-web).
Deployment `appgdep_6ab94c1622c08191a90106ab90f1b214` succeeded at
2026-09-27T17:02:24.310595+00:00, owner-private, environment revision 3.
Version `appgprj_6a9f705d212c81919faf0ab726e4dfc6~appgver_3bb17502e0b48191a706885af2fc07b4`.
Live D1 overview confirms `publication_sets` exists. Migration 0008 is deployed.

API/CLI/MCP can create, list, read and revise native sets with account references.
Local SQLite service tests cover actual authorization, workspace isolation,
read/editor/approver permissions, idempotent creation, stale revisions,
duplicate account references and list pagination. Local HTTP MCP tests passed
with 20 tools and exercised all four set operations with read/write credentials.
TypeScript, scoped lint and production build passed. During protocol testing,
the local database needed the previously deployed media_ids migration 0007;
this was applied locally, without changes to that production migration.

Provider references remain unverified metadata. They grant no additional access
and do not alter any draft or delivery. UI selector, draft association, import
of remote groups and account verification are pending. No production API set
creation or social publication was attempted in this iteration.
