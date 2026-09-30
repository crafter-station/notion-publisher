# Open Publisher — provider map

Open Publisher is the product name. Existing repository paths and Notion database
names are integration identifiers; migrate them separately without breaking
existing jobs, buttons or imports.

## Delivery order — user decision, 2026-09-09

1. Finish the existing Notion workflow first so the team can use it immediately.
   Verify each existing provider connection, required input mapping, execution
   path, status/error writeback and output links. A read-only account listing is
   not acceptance of a publishing integration. Keep explicit upstream blockers.
2. Migrate that working functionality to the web application incrementally.
   Do not build a parallel workflow with fewer channels or different semantics.
   Notion stays authoritative until a deliberate field-ownership cutover.
3. The web UI must default to dark mode, show the complete channel catalog using
   the existing Events / Products / Social / Music-Podcast divisions and the
   documented Postiz subcategories, and expose provider-specific required fields.
4. Previews must represent the selected platform and content format, including
   relevant media and channel fields. The current generic text card is not an
   accepted preview. Distinguish deterministic rendering from platform behavior
   that cannot be guaranteed by an API preview.

Current private web deployment is an incomplete workbench, not the migration's
acceptance target. Pause further web feature expansion until the Notion path is
operational; preserve existing work for subsequent migration.

## Model

- A channel is a destination such as Instagram or LinkedIn.
- A provider delivers to it: Postly, Typefully via Composio, Postiz, Buffer,
  Hootsuite or a direct API.
- A connection belongs to a workspace and identifies the provider account and
  the actual destination account. Two providers can expose the same destination.
- Operations and field requirements depend on channel, provider and connection
  permissions. UI, API and MCP must consult the same capability contract.
- A publishing job selects a route explicitly. Never fan out through two
  providers to the same account unintentionally or silently change providers
  after an ambiguous write timeout.

## Expansion candidates

| Provider | Documented surface | Open Publisher state |
|---|---|---|
| Buffer | GraphQL, MCP, CLI; channels, posts, ideas, organizations | Mapped; no account connected or adapter implemented |
| Hootsuite | REST API and publishing via Perch MCP | Mapped; no account connected or adapter implemented |
| Other schedulers | Investigate official API/MCP, supported actions, access conditions and account discovery | Requests can be mapped without claiming support |

Sources checked 2026-09-08:

- https://developers.buffer.com/guides/introduction.html
- https://developers.buffer.com/guides/getting-started.html
- https://buffer.com/resources/buffer-api-is-here/
- https://www.hootsuite.com/docs
- https://apidocs.hootsuite.com/docs/api/index.html

## Adapter acceptance

Each implemented adapter must expose discoverable operations and validated
inputs, account readiness, actionable errors, rate limits where available,
media constraints, result identifiers and publication status. Team authorization
and idempotency apply equally to human and agent callers. Tests distinguish
contract simulation, authenticated reads and end-to-end write verification.

Unknown capabilities remain unknown. No generic "connected" indicator can
stand in for every channel/action. Connection onboarding must state when an
OAuth consent, provider application approval or paid plan is required.
