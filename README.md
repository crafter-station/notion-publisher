<div align="center">

```
            _   _                   ____        _     _ _     _
 _ __   ___| |_(_) ___  _ __       |  _ \ _   _| |__ | (_)___| |__   ___ _ __
| '_ \ / _ \ __| |/ _ \| '_ \ _____| |_) | | | | '_ \| | / __| '_ \ / _ \ '__|
| | | | (_) | |_| | (_) | | | |_____|  __/| |_| | |_) | | \__ \ | | |  __/ |
|_| |_|\___/ \__|_|\___/|_| |_|     |_|    \__,_|_.__/|_|_|___/_| |_|\___|_|
```

**Notion CMS orchestrator** — publish **events**, **products**, **social**, and **music/podcast** from Notion pages + automations.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white)](./package.json)
[![Node](https://img.shields.io/badge/Node-%3E%3D18-339933?logo=nodedotjs&logoColor=white)](./package.json)
[![Notion](https://img.shields.io/badge/CMS-Notion-000000?logo=notion&logoColor=white)](https://www.notion.so/)
[![Gumroad](https://img.shields.io/badge/Products-Gumroad-FF90E8)](https://gumroad.com/)
[![Postly](https://img.shields.io/badge/Social-Postly-5B5BD6)](https://postly.ai/)
[![License](https://img.shields.io/badge/License-Private-lightgrey)](#license)

<p>
  <img src="docs/assets/logos/luma.png" width="28" height="28" alt="Luma"/>
  <img src="docs/assets/logos/gumroad.png" width="28" height="28" alt="Gumroad"/>
  <img src="docs/assets/logos/github.png" width="28" height="28" alt="GitHub"/>
  <img src="docs/assets/logos/skool.png" width="28" height="28" alt="Skool"/>
  <img src="docs/assets/logos/myskool.png" width="28" height="28" alt="MySkool"/>
  <img src="docs/assets/logos/postly.png" width="28" height="28" alt="Postly"/>
  <img src="docs/assets/logos/typefully.png" width="28" height="28" alt="Typefully"/>
  <img src="docs/assets/logos/postiz.png" width="28" height="28" alt="Postiz"/>
  <img src="docs/assets/logos/once.png" width="28" height="28" alt="ONCE"/>
</p>

Hosted at [`Nucleo-Lab/notion-publisher`](https://github.com/Nucleo-Lab/notion-publisher) *(private)*.  
Matrices · channels · discovery → **[CAPABILITIES.md](./CAPABILITIES.md)**

</div>

---

## Architecture

![Publisher capability flow](./docs/assets/publisher-capability-flow.png)

Source: [`docs/assets/publisher-capability-flow.excalidraw`](./docs/assets/publisher-capability-flow.excalidraw)

```text
Notion CMS  →  notion-publisher (this repo · no UI)
                    ├─ Events         → Luma (stub)
                    ├─ Products       → Gumroad (live) · GitHub (stub) · Skool/MySkool (discover)
                    ├─ Social         → Postly (live) · Typefully (stub) · Postiz (stub)
                    └─ Music/Podcast  → ONCE.app (stub)
```

Same **product** can ship to **Gumroad + GitHub + Skool** (Skool also adds community). Social stack: Postly = broad cloud; Typefully = cheaper text accounts (X / LinkedIn / Threads / Mastodon); Postiz = widest surface, prefer **self-hosted**.

**Live publish today:** Gumroad + Postly only.  
**Discover:** Skool via MySkool read API.  
Favicons: [`docs/assets/logos/`](./docs/assets/logos/).

---

## Status matrix

| | Distributor | Site | Layer | Status |
|---|---|---|---|---|
| <img src="docs/assets/logos/luma.png" width="20" alt=""> | **Luma** | [luma.com](https://luma.com/) | Events | stub |
| <img src="docs/assets/logos/gumroad.png" width="20" alt=""> | **Gumroad** | [gumroad.com](https://gumroad.com/) | Products | **live** |
| <img src="docs/assets/logos/github.png" width="20" alt=""> | **GitHub** | [github.com](https://github.com/) | Products | stub |
| <img src="docs/assets/logos/skool.png" width="20" alt=""> <img src="docs/assets/logos/myskool.png" width="20" alt=""> | **Skool (MySkool)** | [skool.com](https://www.skool.com/) · [myskool.xyz](https://myskool.xyz/) | Products + community | **discover** |
| <img src="docs/assets/logos/postly.png" width="20" alt=""> | **Postly** | [postly.ai](https://postly.ai/) | Social | **live** |
| <img src="docs/assets/logos/typefully.png" width="20" alt=""> | **Typefully** | [typefully.com](https://typefully.com/) | Social | stub |
| <img src="docs/assets/logos/postiz.png" width="20" alt=""> | **Postiz** | [postiz.com](https://postiz.com/) | Social | stub |
| <img src="docs/assets/logos/once.png" width="20" alt=""> | **ONCE.app** | [beta.once.app](https://beta.once.app/) | Music / Podcast | stub |

---

## <img src="docs/assets/logos/luma.png" width="22" alt=""> Luma (stub, events)

Workshops, launches, calendar events. **Mapped only.** Env: `LUMA_API_KEY`. No client, no webhook.

**Notion fields:** TBD when wired.

---

## Products layer

One digital product → optionally **Gumroad + GitHub + Skool**.

### <img src="docs/assets/logos/gumroad.png" width="22" alt=""> Gumroad (live)

Digital storefront for GPT-Chain JSON (and similar) files.

**What we implement:** create draft · multipart file/cover upload · publish / unpublish · daily autopilot.

#### Notion property contract (case-sensitive)

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

**Daily flow:** fill title / landing / cover / thumbnail + paste JSON into `Template` → Notion automation → `POST /webhooks/publish-gumroad` → status + URLs sync back.

**Draft safety:** missing/invalid `Template` (or other completeness gates) → Gumroad **draft** only; Notion `Unpublished`. Fix and re-run.

**Unpublish:** `POST /webhooks/unpublish-gumroad` (reads `Gumroad Product ID`).

**Autopilot (optional):** `GUMROAD_AUTOPILOT_ENABLED=true` polls a Notion DB with daily quota / timezone / `GUMROAD_AUTOPILOT_PUBLISH_LIVE`.

---

### <img src="docs/assets/logos/github.png" width="22" alt=""> GitHub (stub, products)

Ship the same product as a **GitHub Release** (assets + notes). **Mapped only** — no publish webhook yet. Env: `GITHUB_TOKEN`.

#### Notion property contract (**planned**)

**Inputs (proposed):**

| Property | Type | Role |
|---|---|---|
| `GitHub Repo` | Rich text / URL | `owner/repo` or repo URL |
| `Release Tag` | Rich text | e.g. `v1.2.0` |
| `Release Notes` | Rich text | Release body (markdown) |
| `Template` | Rich text | Same product JSON/file source as Gumroad (when wired) |
| `GitHub Asset` | Files & media | Optional override file for the release asset |

**Outputs (proposed):**

| Property | Type | Role |
|---|---|---|
| `GitHub Publish Status` | Status | `Not started` / `Published` / `Failed` |
| `GitHub Release URL` | URL | Public release page |
| `GitHub Release ID` | Rich text | API id for updates |

---

### <img src="docs/assets/logos/skool.png" width="22" alt=""> <img src="docs/assets/logos/myskool.png" width="22" alt=""> Skool / MySkool (discover)

Community posts and groups. **Channels** = Skool groups attached to the MySkool API key. Product + community in one place.

Docs: https://myskool.xyz/docs · API: `https://api.myskool.xyz/v1` · Auth: `Bearer sk_live_…`

**Implemented (read):** `listGroups`, `getGroup`, `listGroupPosts`, `getPost`, `listComments` → `GET /capabilities/skool`.

**Planned upstream:** `POST /v1/posts` (Phase 2) — then a Notion → Skool publish webhook.

#### Notion property contract (**planned** for write)

| Property | Type | Role |
|---|---|---|
| `Skool Group ID` | Rich text | Target group (`gid`) — or use env `SKOOL_GROUP_ID` |
| `Skool Title` | Rich text | Post title |
| `Skool Body` | Rich text | Post body / markdown |
| `Skool Publish Status` | Status | Output when write ships |
| `Skool Post URL` | URL | Output when write ships |

Mint a fresh key at https://myskool.xyz if you see `401`. **Never commit** `SKOOL_API_KEY`.

```bash
curl -s localhost:3000/capabilities/skool | jq .
```

---

## Social layer

### <img src="docs/assets/logos/postly.png" width="22" alt=""> Postly (live)

Broad multi-platform cloud distribution. OpenAPI: https://docs.postly.ai/openapi.yaml

**Catalog families:** social (`instagram`, `facebook`, `linkedin`, `x`, `threads`, `tiktok`, `youtube`, `pinterest`, `bluesky`, `googleMyBusiness`) · messaging (`telegram`, `whatsapp`) · blog · email · `reddit` (`docs_only`).

Live targets still come from `POSTLY_TARGET_PLATFORMS` (`identifier:id`). New catalog channels are **not** auto-published until you opt in. `POSTLY_AUDIENCE_GROUP` documented, unused by default publish.

#### Notion property contract (case-sensitive)

**Inputs (you fill)** — AI POVs / social DB:

| Property | Type | Role |
|---|---|---|
| `POV Text` | Rich text | Global fallback caption |
| `Instagram Caption` | Rich text | Instagram override |
| `Facebook Post` | Rich text | Facebook override |
| `LinkedIn Post` | Rich text | LinkedIn override |
| `TikTok Caption` | Rich text | TikTok override |
| `Twitter Post` | Rich text | Threads (and related) override |
| `Pinterest Title` | Rich text | Pinterest title |
| `Pinterest Description` | Rich text | Pinterest description |
| `YouTube Title` | Rich text | YouTube title |
| `YouTube Caption` | Rich text | YouTube description |
| `Universal First Comment` | Rich text | First-comment text when supported |
| `Video` / `GIF` / `Screenshot` | Files & media | Media (priority: Video → GIF → Screenshot) |

**Outputs (bot fills):**

| Property | Type | Role |
|---|---|---|
| `Status` | Status | Aggregate (`Published` / `Postly Error` / in-progress states) |
| `Instagram Status` | Status | Legacy/per-row IG status when present |
| `Instagram URL` | URL | Live post URL(s) |
| `Post ID` | Rich text | Multi-line `<platform>: <id>` |
| `Postly Error` | Rich text / status | Failure detail when used |

**Targeting:** default = all `POSTLY_TARGET_PLATFORMS`. Selective: `?target=0` or `?target=0,2`.

**Async polling:** create post → `202` to Notion → backoff `[30s, 10s, 20s, 30s, 40s, 50s, 60s]` → write URLs + IDs back.

**Queue (optional):** `POSTLY_QUEUE_ENABLED=true`.

---

### <img src="docs/assets/logos/typefully.png" width="22" alt=""> Typefully (stub)

Cheaper **text-first** path: X, LinkedIn, Threads, Mastodon — strong per-account granularity. Complements Postly. Env: `TYPEFULLY_API_KEY`.

**Notion fields:** TBD when wired.

---

### <img src="docs/assets/logos/postiz.png" width="22" alt=""> Postiz (stub)

Widest scheduler surface. Cloud can be expensive — prefer **self-hosted**. Env: `POSTIZ_API_KEY`.

**Notion fields:** TBD when wired.

---

## <img src="docs/assets/logos/once.png" width="22" alt=""> ONCE.app (stub, music / podcast)

DSP distribution for music and podcast. **Mapped only.** Env: `ONCE_API_KEY`.

**Notion fields:** TBD when wired.

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

```bash
ngrok http 3000
#   https://<ngrok>/webhooks/publish-gumroad
#   https://<ngrok>/webhooks/unpublish-gumroad
#   https://<ngrok>/webhooks/publish-postly
```

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
GITHUB_TOKEN=
TYPEFULLY_API_KEY=
POSTIZ_API_KEY=
ONCE_API_KEY=
LUMA_API_KEY=
```

Full knobs: [`.env.example`](./.env.example). Matrices: [CAPABILITIES.md](./CAPABILITIES.md).

### Scripts

```bash
npm run build
npm run dev
npm run capabilities:check
npm run publisher:report
```

---

## Roadmap

1. Skool read / discover ← current
2. Skool write when MySkool `POST /v1/posts` ships
3. GitHub Releases product publish
4. Typefully / Postiz (self-hosted) / ONCE / Luma clients
5. Optional Postly `audience_group` on the live publish path

---

## Contributing

Internal Nucleo Lab / Nebulabs tooling. Prefer tiny diffs; update [`CAPABILITIES.md`](./CAPABILITIES.md) when adding a distributor. Do not invent publish webhooks for stub/discover connectors.

## License

Private repository. All rights reserved unless a `LICENSE` file is added later.
