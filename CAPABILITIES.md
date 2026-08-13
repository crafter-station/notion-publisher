# Publisher Capability Kit

**Notion is the CMS.** This repo is the orchestrator — not a UI. It routes jobs across four layers:

| Layer | Distributors |
|---|---|
| **Products** | <img src="docs/assets/logos/gumroad.png" width="16" alt=""> Gumroad (**live**), <img src="docs/assets/logos/skool.png" width="16" alt=""> <img src="docs/assets/logos/myskool.png" width="16" alt=""> Skool / MySkool (**discover**) |
| **Social** | <img src="docs/assets/logos/postly.png" width="16" alt=""> Postly (**live**), <img src="docs/assets/logos/postiz.png" width="16" alt=""> Postiz (**stub**), <img src="docs/assets/logos/typefully.png" width="16" alt=""> Typefully (**stub**) |
| **Music** | <img src="docs/assets/logos/once.png" width="16" alt=""> ONCE.app (**stub**) |
| **Events** | <img src="docs/assets/logos/luma.png" width="16" alt=""> Luma (**stub**) |

Favicons live in [`docs/assets/logos/`](./docs/assets/logos/) (from each site’s icon metadata).

Statuses:

| Status | Meaning |
|---|---|
| **live** | Publish path wired today |
| **discover** | API readable; no publish webhook yet |
| **stub** | Mapped in registry only |

**Current publish path is unchanged.** Gumroad + Postly webhooks behave as before. New Postly channels / audience groups are discoverable; they are not opted into automatic publishing until you configure them.

Canonical Postly OpenAPI: https://docs.postly.ai/openapi.yaml  
MySkool docs: https://myskool.xyz/docs  

Self-check: `npm run capabilities:check`

## Distributors

| | ID | Layer | Kind | Status | Site | Notes |
|---|---|---|---|---|---|---|
| <img src="docs/assets/logos/gumroad.png" width="18" alt=""> | `gumroad` | Products | marketplace | **live** | [gumroad.com](https://gumroad.com/) | Digital storefront: draft / upload / publish / unpublish + autopilot |
| <img src="docs/assets/logos/skool.png" width="18" alt=""> <img src="docs/assets/logos/myskool.png" width="18" alt=""> | `myskool` | Products | community | **discover** | [skool.com](https://www.skool.com/) · [myskool.xyz](https://myskool.xyz/) | MySkool `https://api.myskool.xyz/v1` — read groups/posts/comments. Create post = upstream Phase 2 |
| <img src="docs/assets/logos/postly.png" width="18" alt=""> | `postly` | Social | social | **live** | [postly.ai](https://postly.ai/) | Multi-channel + audience groups discoverable |
| <img src="docs/assets/logos/postiz.png" width="18" alt=""> | `postiz` | Social | social | stub | [postiz.com](https://postiz.com/) | Alternate multi-platform scheduler — wire when account ready |
| <img src="docs/assets/logos/typefully.png" width="18" alt=""> | `typefully` | Social | social | stub | [typefully.com](https://typefully.com/) | X/Twitter drafts & threads; complements Postly |
| <img src="docs/assets/logos/once.png" width="18" alt=""> | `once` | Music | music | stub | [beta.once.app](https://beta.once.app/) | ONCE.app DSP distribution — mapped only |
| <img src="docs/assets/logos/luma.png" width="18" alt=""> | `luma` | Events | other | stub | [luma.com](https://luma.com/) | Events (Luma / lu.ma) — mapped only |

Legacy ids `nce` / `postis` are **removed**.

## Discovery endpoints (read-only)

| Method | Path | Body |
|---|---|---|
| `GET` | `/capabilities` | Static registry + layers + Postly platform catalog |
| `GET` | `/capabilities/postly` | Live socials + audience groups for `POSTLY_WORKSPACE_ID` |
| `GET` | `/capabilities/skool` | Without key → stub message; with `SKOOL_API_KEY` → groups (+ sample posts) |

No publish side effects on any of these routes.

### Skool smoke

```bash
# After minting sk_live_… from https://myskool.xyz and setting SKOOL_API_KEY in .env
curl -s localhost:3000/capabilities/skool | jq .
```

Optional: `SKOOL_GROUP_ID` pins which group supplies sample posts.

## Products layer — channels

### Gumroad (live)

- Channel: your Gumroad storefront / product listings
- Implemented: create draft, file + cover upload, publish, unpublish, daily autopilot
- Notion property contract: see [README.md](./README.md)

### Skool / MySkool (discover)

- Channels = Skool **groups/communities** attached to the API key
- Implemented (client): `listGroups`, `getGroup`, `listGroupPosts`, `getPost`, `listComments`
- Planned upstream (not in this repo yet): `POST /v1/posts`, comments write, members, courses/events
- **No** `/webhooks/publish-skool` until MySkool create-post ships

## Social layer — channels

### Postly (live)

Identifiers from OpenAPI create-post settings discriminator:

| Identifier | Family | Catalog |
|---|---|---|
| `instagram`, `facebook`, `linkedin`, `x`, `threads`, `tiktok`, `youtube`, `pinterest`, `bluesky`, `googleMyBusiness` | social | `api` |
| `telegram`, `whatsapp` | messaging | `api` |
| `wordpress`, `ghost`, `hashnode`, `devTo`, `blogger` | blog | `api` |
| `email` (+ providers like `brevo`, `kit`, …) | email | `api` |
| `reddit` | social | `docs_only` |

Connection state is per workspace — call `GET /capabilities/postly`. Default publish still uses `POSTLY_TARGET_PLATFORMS` only.

Audience groups: create-post accepts **either** `target_platforms` **or** `audience_group`. Optional env `POSTLY_AUDIENCE_GROUP` is documented but **unused by default publish**.

### Postiz (stub)

Alternate social scheduler. Channels documented as “wire when account ready”. Env: `POSTIZ_API_KEY`.

### Typefully (stub)

X/Twitter drafts & threads. Complements Postly (audience group name “Postly + Typefully”). Env: `TYPEFULLY_API_KEY`.

## Music layer — channels

### ONCE.app (stub)

DSP distribution. Mapped only. Env: `ONCE_API_KEY`.

## Events layer — channels

### Luma (stub)

Events on Luma / lu.ma. Mapped only. Env: `LUMA_API_KEY`.

## Code map

- Registry: `src/capabilities/registry.ts`
- Postly catalog: `src/services/postly-platforms.catalog.ts`
- Postly client: `src/services/postly.service.ts`
- Skool client: `src/services/skool.service.ts`
- Platform override stubs (`bluesky` / `telegram` / `x`): `src/use-cases/publish-postly.use-case.ts` — only fire if those identifiers appear in resolved targets
- Logos: `docs/assets/logos/`

## Roadmap

1. Skool read/discover ← **this pass**
2. Skool write when MySkool Phase 2 (`POST /v1/posts`) lands
3. Postiz / Typefully / ONCE / Luma clients when accounts are ready
4. Optional Postly `audience_group` opt-in on the publish path
