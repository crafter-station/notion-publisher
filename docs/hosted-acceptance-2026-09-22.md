# Hosted acceptance — 2026-09-22

Scope: authenticated owner session in the production Sites application, browser UI at 390 × 844. This is not acceptance of all channels or all team roles.

## Verified through the UI

- `/reviews` loaded an empty pending queue and four private drafts. The draft cards fit the viewport; document width and viewport width both measured 390 px.
- Opened existing private Notion fixture `notion-31fa72385631e8486ffe43a6d47be01d8863df3a60d8a7c4529a82a0d233dfde` from its card.
- Compared with Notion: remote changes were detected. Incorporated them successfully; the UI reported local edits preserved. Shared text remained the private roundtrip test copy.
- Requested review. Pending queue showed the fixture at revision 4.
- Opened the content and approved it. Approved queue showed revision 5.
- Appended ` · QA` to the internal title and saved. Revision 6 returned to draft and exposed Request review again.
- Restored the original title and saved. Final state: revision 7, draft. No public post or schedule was created. Browser viewport override was reset.

## UI fixes published

Sites version 30, source `e95822fafd42458880f294607a5f5f667a67d0de`, deployment `appgdep_6ab2a4c415b081918e5a58f4314780d1` succeeded at 2026-09-22T15:55:09Z.

- Typefully account selection queries only Typefully, avoiding waits for unrelated providers; 45-second timeout allows retry after a stalled request.
- Review listing has a 30-second timeout, preventing an indefinite loading state with Refresh disabled.
- Eyebrow text uses the foreground-muted token rather than the dark muted surface token.

Provider-selection regression check, TypeScript check, scoped lint and production build passed. The mobile review workflow above exercised version 29 before these fixes were deployed; visual verification of the new contrast and timeout behavior in version 30 remains separate.

## Still incomplete

Postiz API is healthy but reports zero connected accounts among 34 installed variants. LinkedIn and both Instagram routes lack OAuth application credentials. Direct Notion-to-Typefully webhook deployment and its Notion button remain pending. Named MCP-client installation, complete native previews and publishing capabilities across the catalog are not established by this check.
