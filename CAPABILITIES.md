# Publisher Capability Kit

Portable distribution toolkit. Install this repo into any workflow that needs to publish — capabilities are mapped even when a connector is not wired yet.

**Current publish path is unchanged.** New Postly channels / audience groups are discoverable; they are not opted into automatic publishing until you configure them.

Canonical Postly OpenAPI: https://docs.postly.ai/openapi.yaml  
(Context7 does not index Postly.ai.)

## Distributors

| ID | Kind | Status | Notes |
|---|---|---|---|
| `gumroad` | marketplace | **live** | Product create / publish / unpublish |
| `postly` | social | **live** | Multi-channel social (+ audience groups discoverable) |
| `myskool` | community | stub | MySkool Skool API — read Phase 1; create post upstream Phase 2 |
| `typefully` | social | stub | External X path (not Postly). Group name “Postly + Typefully” means X stays here |
| `nce` | music | stub | Music distribution (planned) |
| `postis` | other | stub | Future connector (planned) |

Self-check: `npm run capabilities:check`

## Discovery endpoints (read-only)

| Method | Path | Body |
|---|---|---|
| `GET` | `/capabilities` | Static registry + Postly platform catalog |
| `GET` | `/capabilities/postly` | Live socials + audience groups for `POSTLY_WORKSPACE_ID` |

No publish side effects.

## Postly platform matrix (API)

Identifiers from OpenAPI create-post settings discriminator:

| Identifier | Family | Catalog |
|---|---|---|
| `instagram`, `facebook`, `linkedin`, `x`, `threads`, `tiktok`, `youtube`, `pinterest`, `bluesky`, `googleMyBusiness` | social | `api` |
| `telegram`, `whatsapp` | messaging | `api` |
| `wordpress`, `ghost`, `hashnode`, `devTo`, `blogger` | blog | `api` |
| `email` (+ providers like `brevo`, `kit`, …) | email | `api` |
| `reddit` | social | `docs_only` (still in OpenAPI; often removed from accounts/UI) |

Connection state is per workspace — call `GET /capabilities/postly`. Many catalog platforms may show **0 connected** until you link them in Postly.

## Audience groups

Postly create-post accepts **either** `target_platforms` **or** `audience_group` (`anyOf`).

- List: `GET /v1/workspaces/{workspaceId}/audience-groups` (also exposed via `GET /capabilities/postly`)
- Use returned `id` / `audience_group_id` in the `audience_group` field when you opt in later
- Optional env (documented, **unused by default publish**): `POSTLY_AUDIENCE_GROUP=`

Example groups in a shared workspace (illustrative):

- **Nebulabs EN** — matches the current explicit `POSTLY_TARGET_PLATFORMS` set
- **GPT Chain - Postly + Typefully** — Bluesky, Telegram, IG/FB/LI/Threads/Pinterest; X remains Typefully

## Code map

- Registry: `src/capabilities/registry.ts`
- Postly catalog: `src/services/postly-platforms.catalog.ts`
- Postly client: `src/services/postly.service.ts` (`listSocials`, `listAudienceGroups`, optional `audience_group` on `createPost`)
- Platform override stubs (`bluesky` / `telegram` / `x`): `src/use-cases/publish-postly.use-case.ts` — only fire if those identifiers appear in resolved targets

## Future opt-in (not done)

1. Add channel IDs to `POSTLY_TARGET_PLATFORMS`, **or** set `POSTLY_AUDIENCE_GROUP` and teach the publish use-case to prefer it
2. Wire MySkool when `SKOOL_API_KEY` is valid (read first)
3. Implement Typefully / NCE / Postis clients when needed
