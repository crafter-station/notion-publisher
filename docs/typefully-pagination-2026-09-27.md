# Typefully social-set pagination — 2026-09-27

Source commit: publisher-web `835250ffe2e1b43e627f8d1b0a0cb86e31498de7`.

The connection adapter follows additional social-set list pages through the
existing Composio tool. It extracts only validated pagination arguments from
Typefully's next URL, never sends credentials to that URL, and rejects duplicate
sets, repeated/skipped cursors and incomplete provider calls. Existing 20-second
request deadline remains; very large or slow inventories may still time out.

Validation:
- `check-typefully-pagination.mjs`: mocked provider, 52 sets over two pages,
  stable account references, foreign/stalled/skipped cursors, duplicates and
  page/detail failures. Failed reads expose no partially verified inventory.
- TypeScript, scoped lint and production build passed.
- Read-only invocation of the actual adapter with local `.dev.vars` credentials:
  `read_verified`, **1 social set, 6 accounts**, 3999 ms,
  checked at 2026-09-27T16:52:00.635Z. No post or draft was created.
  This does not establish hosted credential behavior or real multi-page coverage.

Deployment succeeded at 2026-09-27T16:52:31.329596+00:00:
- Project: `appgprj_6a9f705d212c81919faf0ab726e4dfc6`
- Version: `appgprj_6a9f705d212c81919faf0ab726e4dfc6~appgver_375da9fd874c8191bb6b435c670d4b34`
- Deployment: `appgdep_6ab949c275e88191b63eab0d569a27b8`
- URL: https://publisher-crafter-station.theveller.chatgpt.site
- Owner-private audience preserved, environment revision 3.

Native publication sets, editor context filtering and per-set delivery permissions
remain pending in the full goal. Provider account counts are not group counts.
