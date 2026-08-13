```
 ____        _     _ _     _
|  _ \ _   _| |__ | (_)___| |__   ___ _ __
| |_) | | | | '_ \| | / __| '_ \ / _ \ '__|
|  __/| |_| | |_) | | \__ \ | | |  __/ |
|_|    \__,_|_.__/|_|_|___/_| |_|\___|_|
  Notion CMS orchestrator · Products · Social · Music · Events
```

**Notion is the CMS. This repo is the orchestrator** — a portable HTTP microservice that turns Notion pages + automations into publish jobs across **products**, **social**, **music**, and **events**. There is no product UI here; callers (Notion automations, scripts, other services) hit webhooks and discovery endpoints.

> Hosted at [`Nucleo-Lab/gumroad-published`](https://github.com/Nucleo-Lab/gumroad-published) (private). Nebulabs / GPT Chain brands publish through the same kit.

Distributor matrices and channel catalogs: **[CAPABILITIES.md](./CAPABILITIES.md)**.

Favicons below pulled from each site’s HTML metadata (`rel=icon` / `apple-touch-icon`) into [`docs/assets/logos/`](./docs/assets/logos/).

---

## Architecture

![Publisher capability flow](./docs/assets/publisher-capability-flow.png)

Source: [`docs/assets/publisher-capability-flow.excalidraw`](./docs/assets/publisher-capability-flow.excalidraw)

```text
Notion CMS  →  Publisher orchestrator (this repo)
                    ├─ Products  → Gumroad (live) · Skool/MySkool (discover)
                    ├─ Social    → Postly (live) · Postiz (stub) · Typefully (stub)
                    ├─ Music     → ONCE.app (stub)
                    └─ Events    → Luma (stub)
```

- **Notion** = source of truth (pages, files, captions, JSON templates). Automations fire webhooks.
- **This service** = routes product vs social vs music vs events jobs; writes status/URLs back to Notion.
- **Live publish today:** Gumroad + Postly only.
- **This pass:** Skool via MySkool is **discover** (read groups/posts). Create-post is still upstream Phase 2 — **no fake Skool publish webhook**.

---

## Status matrix

| | Distributor | Site | Layer | Status | What you can do now |
|---|---|---|---|---|---|
| <img src="docs/assets/logos/gumroad.png" width="20" alt="Gumroad"> | **Gumroad** | [gumroad.com](https://gumroad.com/) | Products | **live** | Draft → upload → publish / unpublish + autopilot |
| <img src="docs/assets/logos/skool.png" width="20" alt="Skool"> <img src="docs/assets/logos/myskool.png" width="20" alt="MySkool"> | **Skool (MySkool)** | [skool.com](https://www.skool.com/) · [myskool.xyz](https://myskool.xyz/) | Products / community | **discover** | `GET /capabilities/skool` lists groups (+ sample posts) |
| <img src="docs/assets/logos/postly.png" width="20" alt="Postly"> | **Postly** | [postly.ai](https://postly.ai/) | Social | **live** | Multi-platform publish + polling; catalog discovery |
| <img src="docs/assets/logos/postiz.png" width="20" alt="Postiz"> | **Postiz** | [postiz.com](https://postiz.com/) | Social | stub | Registry + env slot only |
| <img src="docs/assets/logos/typefully.png" width="20" alt="Typefully"> | **Typefully** | [typefully.com](https://typefully.com/) | Social | stub | Registry + env slot only (X/threads companion) |
| <img src="docs/assets/logos/once.png" width="20" alt="ONCE"> | **ONCE.app** | [beta.once.app](https://beta.once.app/) | Music | stub | Registry + env slot only |
| <img src="docs/assets/logos/luma.png" width="20" alt="Luma"> | **Luma** | [luma.com](https://luma.com/) | Events | stub | Registry + env slot only |

---

## <img src="docs/assets/logos/gumroad.png" width="22" alt=""> Gumroad (live, products)

Digital product storefront for GPT-Chain JSON (and similar) files.

### What we implement

- Create Gumroad **draft**
- Multipart **file + cover/thumbnail** upload
- **Publish** / **unpublish**
- Daily **autopilot** (quota + completeness gates; see env below)

### Notion property contract (case-sensitive)

**Inputs (you fill):**

| Property | Type | Role |
|---|---|---|
| `Gumroad Title` | Rich text | Product title (fallback: `Prompt Chain Template Name`) |
| `Landing Page Copy` | Rich text | Store description (markdown → HTML in pipeline) |
| `Template` | Rich text | **Required for live publish.** Valid JSON; Notion may fragment long values — service reassembles |
| `Gumroad Cover` | Files & media | Promotional cover |
| `Gumroad Thumbnail` | Files & media | Square feed thumbnail |

**Outputs (bot fills):**

| Property | Type | Role |
|---|---|---|
| `Gumroad Publish Status` | Status | `Not started` / `Unpublished` / `Published` / `Failed` |
| `Gumroad Product ID` | Rich text | Internal id (needed to unpublish) |
| `Gumroad URL` | URL | Public short link |
| `Gumroad Edit URL` | URL | Gumroad admin edit link |

### Daily flow

1. Fill title, landing copy, cover/thumbnail; paste JSON into `Template`.
2. Trigger Notion automation → `POST /webhooks/publish-gumroad`.
3. Status + URLs sync back to the row.

**Draft safety:** missing/invalid `Template` (or other completeness gates) → Gumroad **draft** only; Notion status `Unpublished`. Fix the row and re-run.

**Unpublish:** automation → `POST /webhooks/unpublish-gumroad` (reads `Gumroad Product ID`).

### Autopilot (optional)

When `GUMROAD_AUTOPILOT_ENABLED=true`, the service polls a Notion database on an interval, publishes complete rows up to `GUMROAD_AUTOPILOT_DAILY_LIMIT` (timezone `GUMROAD_AUTOPILOT_TIMEZONE`). `GUMROAD_AUTOPILOT_PUBLISH_LIVE=false` keeps autopilot in draft mode.

---

## <img src="docs/assets/logos/skool.png" width="22" alt=""> <img src="docs/assets/logos/myskool.png" width="22" alt=""> Skool / MySkool (discover this pass)

Community posts and groups. **Channels** = Skool groups/communities connected to your MySkool API key.

Docs: https://myskool.xyz/docs · API base: `https://api.myskool.xyz/v1` · Auth: `Authorization: Bearer sk_live_…`

### Implemented (read client)

| Method | Path |
|---|---|
| GET | `/v1/groups` |
| GET | `/v1/groups/:gid` |
| GET | `/v1/groups/:gid/posts` |
| GET | `/v1/posts/:id` |
| GET | `/v1/posts/:id/comments` |

Exposed locally as `GET /capabilities/skool` (see [HTTP surface](#http-surface)).

### Planned (upstream — not wired here)

- `POST /v1/posts` (MySkool Phase 2)
- Comment create, members, courses/events
- Any Notion → Skool **publish** webhook

Mint a fresh key in the MySkool dashboard if you previously saw `401`. **Never commit** `SKOOL_API_KEY`.

```bash
curl -s localhost:3000/capabilities/skool | jq .
```

---

## <img src="docs/assets/logos/postly.png" width="22" alt=""> Postly (live, social)

Multi-platform social (and related) distribution. Canonical OpenAPI: https://docs.postly.ai/openapi.yaml

### Platform catalog (capability)

| Family | Identifiers | Notes |
|---|---|---|
| Social | `instagram`, `facebook`, `linkedin`, `x`, `threads`, `tiktok`, `youtube`, `pinterest`, `bluesky`, `googleMyBusiness` | `api` |
| Messaging | `telegram`, `whatsapp` | `api` |
| Blog | `wordpress`, `ghost`, `hashnode`, `devTo`, `blogger` | `api` |
| Email | `email` (+ providers) | `api` |
| Social | `reddit` | `docs_only` |

**Live publish targets** still come from `POSTLY_TARGET_PLATFORMS` (preferred `identifier:id` pairs). New catalog channels are **not** auto-published until you opt in. Audience groups are discoverable via `GET /capabilities/postly`; env `POSTLY_AUDIENCE_GROUP` is unused by the default publish path.

### Notion property contract (high level)

**Inputs:** per-platform captions (e.g. `Instagram Caption`, plus other POV/platform fields the parser reads), media via `Video` / `GIF` / `Screenshot`.  
**Outputs:** aggregate status, public URLs, `Post ID` lines per platform.

Property names are case-sensitive — keep the existing AI POVs / social database schema.

### Targeting

Default: all entries in `POSTLY_TARGET_PLATFORMS`.

Selective: `POST /webhooks/publish-postly?target=0` or `?target=0,2` (0-based indexes into that list).

### Async polling

1. Detect image vs `.mp4`; build Postly payload (per-platform caption overrides when present).
2. Create post → respond `202` quickly so Notion does not time out.
3. Background exponential backoff poll: `[30s, 10s, 20s, 30s, 40s, 50s, 60s]`.
4. When platforms resolve, write URLs + Post IDs back to Notion.

### Queue (optional)

`POSTLY_QUEUE_ENABLED=true` polls a Notion database on `POSTLY_QUEUE_INTERVAL_MS` and publishes eligible rows (with pending-post window guards).

---

## <img src="docs/assets/logos/postiz.png" width="22" alt=""> Postiz (stub, social)

Alternate multi-platform social scheduler. **Mapped only** — channels = “wire when account ready”. Env: `POSTIZ_API_KEY`. No client, no webhook. Site: [postiz.com](https://postiz.com/).

---

## <img src="docs/assets/logos/typefully.png" width="22" alt=""> Typefully (stub, social)

X / Twitter drafts and threads. Complements Postly (workspace audience group name often includes “Postly + Typefully”). Env: `TYPEFULLY_API_KEY`. No client, no webhook. Site: [typefully.com](https://typefully.com/).

---

## <img src="docs/assets/logos/once.png" width="22" alt=""> ONCE.app (stub, music)

DSP distribution. **Mapped only.** Env: `ONCE_API_KEY`. No client, no webhook. Site: [beta.once.app](https://beta.once.app/).

---

## <img src="docs/assets/logos/luma.png" width="22" alt=""> Luma (stub, events)

Events (Luma / lu.ma). **Mapped only** — create/list events when account ready. Env: `LUMA_API_KEY`. No client, no webhook. Site: [luma.com](https://luma.com/).

---

## HTTP surface

| Method | Path | Role |
|---|---|---|
| `POST` | `/webhooks/publish-gumroad` | Create / publish product |
| `POST` | `/webhooks/unpublish-gumroad` | Unpublish product |
| `POST` | `/webhooks/publish-postly` | Social publish (`?target=` optional) |
| `GET` | `/capabilities` | Registry + layers + Postly catalog |
| `GET` | `/capabilities/postly` | Live socials + audience groups |
| `GET` | `/capabilities/skool` | MySkool discover (or stub message if no key) |

---

## Quick start

```bash
npm install
cp .env.example .env   # NOTION_TOKEN, GUMROAD_TOKEN, POSTLY_*
npm run build
npm run dev            # http://localhost:3000
npm run capabilities:check
```

Expose for Notion (local):

```bash
ngrok http 3000
#   https://<ngrok>/webhooks/publish-gumroad
#   https://<ngrok>/webhooks/unpublish-gumroad
#   https://<ngrok>/webhooks/publish-postly
```

Free ngrok URLs change on restart — update Notion automations each time.

### Environment (minimal)

```env
NOTION_TOKEN=
GUMROAD_TOKEN=
POSTLY_API_KEY=
POSTLY_WORKSPACE_ID=
POSTLY_TARGET_PLATFORMS=instagram:id,facebook:id

# Optional discover
SKOOL_API_KEY=sk_live_xxxxxxxxxxxx
SKOOL_GROUP_ID=

# Optional stubs (not wired)
POSTIZ_API_KEY=
TYPEFULLY_API_KEY=
ONCE_API_KEY=
LUMA_API_KEY=
```

Full knobs (queues, autopilot, audience group): [`.env.example`](./.env.example). Matrices: [CAPABILITIES.md](./CAPABILITIES.md).

### Scripts

```bash
npm run build
npm run dev
npm run capabilities:check
npm run publisher:report
```

---

## Roadmap

1. **Skool read / discover** ← current
2. **Skool write** when MySkool `POST /v1/posts` ships
3. **Postiz / Typefully / ONCE / Luma** clients when accounts are ready
4. Optional Postly `audience_group` on the live publish path

---

## Contributing

Internal Nucleo Lab / Nebulabs tooling. Prefer tiny diffs; update [`CAPABILITIES.md`](./CAPABILITIES.md) when adding a distributor. Do not invent publish webhooks for stub/discover connectors.

## License

Private repository. All rights reserved unless a `LICENSE` file is added later.
