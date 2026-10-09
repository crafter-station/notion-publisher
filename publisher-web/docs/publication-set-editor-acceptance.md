# Publication sets in the editor — 2026-09-27

Implemented: create a native set from read-only provider inventories, combine provider account references, select/clear the set for a draft, inspect its frozen references, refresh inventory, verify references, and explicitly adopt a newer set revision. Dark responsive UI. No publishing added.

Draft POST/PATCH use server-owned snapshots and optimistic draft revisions. Current set revisions must match when selecting a new snapshot. Resending an existing selection preserves its accounts even after the source set changes. Editing returns approved content to draft. Typefully private-copy payload validation and UI restrict targets to the attached snapshot.

Evidence:
- Real draft routes with SQLite migrations: workspace separation, approver rejection, stale set revision, injected client accounts ignored, approval reset, immutable saved snapshot, omitted-field preservation, explicit update and clear, stale draft rejection.
- Typefully payload: allowed pinned account succeeds; other account/group and empty pinned set fail without provider writes.
- Local HTTP MCP: create/read draft with native set id and revision through real authenticated server; 21 tools remain available.
- Local browser: read Typefully inventory (six accounts), create one-account set, save draft, reload and reopen from mobile draft selector. Selection persisted.
- 390×844 viewport: screenshot inspected, document clientWidth and scrollWidth both 390.
- Local API changed fixture set to revision 2 with no accounts. Editor refresh preserved draft revision-1 snapshot and displayed explicit adoption control. Adoption marked content dirty and disabled review until saved.

Limitations: no production authenticated UI acceptance in this run. No global draft filtering by set, set rename/edit/delete screen, calendar, analytics, agent runtime, or social delivery implemented by this change. Existing broader goal remains incomplete.
