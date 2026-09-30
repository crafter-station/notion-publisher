# Open Publisher review handoff — 2026-09-29

This branch brings the existing publisher backend and the previously separate web application into one reviewable repository. It is a development milestone, not a completed release. The original working directories are preserved.

## Review entry points

- `README.md`: provider/channel coverage and backend operation.
- `publisher-web/README.md`: web setup, authentication, API, CLI and MCP.
- `docs/agent-first-plan.md`: product direction and remaining work.
- `publisher-web/docs/publication-sets-api.md`: account sets and immutable draft snapshots.
- `docs/publication-set-editor-hosted-2026-09-28.md`: authenticated hosted acceptance evidence.

The web app uses D1 for workspace data and R2 for private media, with Notion integration. Publication sets retain account references by provider; changing a set never silently redirects an existing draft. Typefully private-copy targeting respects the saved set. The final interrupted change adds a read-only CLI doctor that tests API authentication and a real MCP initialization, tool discovery and session call without exposing credentials.

## Validation on the fresh review checkout

Root: `npm ci --ignore-scripts` and `npm run build` passed.

In `publisher-web`, installation, `npx tsc --noEmit`, `npm run build` and these checks passed:

- `node scripts/check-agent-doctor.mjs`
- `node scripts/check-agent-client.mjs`
- `node scripts/check-publication-sets.mjs`
- `node scripts/check-media-attachments.mjs`
- `node scripts/check-typefully-payload.mjs`

Build warnings remain for a JSON import without import attributes and vinext static route classification. SQLite test runtime emits an experimental warning.

## Limits and follow-up

- Mapped channels do not imply verified connections or working delivery adapters. Full provider/channel coverage, Postiz OAuth configuration, scheduling and analytics remain unfinished.
- The HTTP/stdio MCP paths exist; native Sites MCP declaration and named-agent onboarding still need completion and verification.
- Hosted acceptance covers the previously deployed editor/set flow. This handoff does not redeploy the site or publish/schedule social content.
- Fresh dependency audits report one high finding in the backend (`form-data`) and nine findings in the web dependency tree (three high, six moderate). These require triage and compatible upgrades before release; no forced upgrades were applied during handoff.
- The live Sites preview remains private. Review source locally or arrange access separately; this PR does not change site visibility.

Environment files, credentials, local databases, build output and dependencies are excluded from the committed snapshot.
