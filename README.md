<div align="center">

```
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   ██████╗ ██╗   ██╗██████╗ ██╗     ██╗███████╗██╗  ██╗   ║
║   ██╔══██╗██║   ██║██╔══██╗██║     ██║██╔════╝██║  ██║   ║
║   ██████╔╝██║   ██║██████╔╝██║     ██║███████╗███████║   ║
║   ██╔═══╝ ██║   ██║██╔══██╗██║     ██║╚════██║██╔══██║   ║
║   ██║     ╚██████╔╝██████╔╝███████╗██║███████║██║  ██║   ║
║   ╚═╝      ╚═════╝ ╚═════╝ ╚══════╝╚═╝╚══════╝╚═╝  ╚═╝   ║
║                                                          ║
║              notion-publisher · Nucleo Lab               ║
╚══════════════════════════════════════════════════════════╝
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

Same **product** can ship to **Gumroad + GitHub + Skool** (Skool also adds community). Social stack: Postly = broad cloud; Typefully = cheaper text accounts (X / LinkedIn / Threads / Mastodon / Bluesky); Postiz = widest surface, prefer **self-hosted**.

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

## Notion DB setup — shared fields

Canonical CMS contract for every publish row. Live Gumroad/Postly parsers still use their existing property names (below); stubs and future wiring should align here.

### Minimum shared schema

| Property | Type | Role |
|---|---|---|
| `Name` | Title | Row identity |
| `Source Tags` | Multi-select | Target distributors: `Luma`, `Gumroad`, `GitHub`, `Skool`, `Postly`, `Typefully`, `Postiz`, `ONCE` |
| `Body` / `POV Text` | Rich text | Global caption / description fallback |
| `Video` | Files & media | Video asset |
| `Image` / `Screenshot` | Files & media | Still image |
| `GIF` | Files & media | Animated |
| `Audio` | Files & media | Podcast / music (ONCE) |
| `File` / `Template` | Files & media **or** rich text | Product payload (Gumroad / GitHub) |
| `Topics` | Multi-select | Content taxonomy (not a distributor) |
| `Status` | Status | Aggregate publish state |

### Multimedia support

| Kind | Typical property | Used by |
|---|---|---|
| Video | `Video` | Postly, Postiz, Skool, Luma cover/reel |
| Image | `Image` / `Screenshot` / covers | All layers |
| GIF | `GIF` | Postly / Postiz |
| Audio | `Audio` | ONCE (music / podcast) |
| Document / JSON | `Template` / `File` | Gumroad, GitHub Releases |

Use **`Source Tags`** to mark which distributors should receive the row; channel-specific caption overrides live under each source below.

---

## <img src="docs/assets/logos/luma.png" width="22" alt=""> Luma (stub, events)

Workshops, launches, calendar. **Mapped only.** Env: `LUMA_API_KEY`.

**Channels:** Luma event page (single surface).

#### Suggested Notion fields

| Property | Type | Role |
|---|---|---|
| `Luma Title` | Rich text | Event title (or reuse `Name`) |
| `Luma Start` | Date | Start datetime |
| `Luma End` | Date | End datetime |
| `Luma Location` | Rich text | Place or `Online` |
| `Luma Description` | Rich text | Event body (or reuse `Body`) |
| `Luma Cover` | Files & media | Hero image (or shared `Image`) |
| `Luma Event URL` | URL | Output when wired |
| `Luma Publish Status` | Status | Output when wired |

Tag row with `Source Tags` → `Luma`.

---

## Products layer

One digital product → optionally **Gumroad + GitHub + Skool**. Set `Source Tags` accordingly.

### <img src="docs/assets/logos/gumroad.png" width="22" alt=""> Gumroad (live)

Digital storefront for GPT-Chain JSON (and similar) files.

**Channels:** Gumroad product listing / storefront.

**What we implement:** create draft · multipart file/cover upload · publish / unpublish · daily autopilot.

#### Notion property contract (case-sensitive, live)

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

**Draft safety:** missing/invalid `Template` → Gumroad **draft** only; Notion `Unpublished`.

**Unpublish:** `POST /webhooks/unpublish-gumroad`. **Autopilot:** `GUMROAD_AUTOPILOT_ENABLED=true`.

---

### <img src="docs/assets/logos/github.png" width="22" alt=""> GitHub (stub, products)

Ship the same product as a **GitHub Release** (assets + notes). Env: `GITHUB_TOKEN`.

**Channels:** GitHub Releases (downloadable assets).

#### Notion property contract (**planned**)

| Property | Type | Role |
|---|---|---|
| `GitHub Repo` | Rich text / URL | `owner/repo` or repo URL |
| `Release Tag` | Rich text | e.g. `v1.2.0` |
| `Release Notes` | Rich text | Release body (markdown) |
| `Template` | Rich text | Same product JSON/file source as Gumroad |
| `GitHub Asset` | Files & media | Optional override file for the release asset |
| `GitHub Publish Status` | Status | Output |
| `GitHub Release URL` | URL | Output |
| `GitHub Release ID` | Rich text | Output |

---

### <img src="docs/assets/logos/skool.png" width="22" alt=""> <img src="docs/assets/logos/myskool.png" width="22" alt=""> Skool / MySkool (discover)

**Channels:** Skool **groups/communities** attached to the MySkool API key (product drop + community post).

Docs: https://myskool.xyz/docs · API: `https://api.myskool.xyz/v1` · Auth: `Bearer sk_live_…`

**Implemented (read):** groups / posts / comments → `GET /capabilities/skool`.  
**Planned upstream:** `POST /v1/posts` (Phase 2).

#### Notion property contract (**planned** for write)

| Property | Type | Role |
|---|---|---|
| `Skool Group ID` | Rich text | Target group (`gid`) — or env `SKOOL_GROUP_ID` |
| `Skool Title` | Rich text | Post title |
| `Skool Body` | Rich text | Post body / markdown |
| `Skool Media` | Files & media | Optional (or shared `Video` / `Image`) |
| `Skool Publish Status` | Status | Output when write ships |
| `Skool Post URL` | URL | Output when write ships |

```bash
curl -s localhost:3000/capabilities/skool | jq .
```

---

## Social layer

### <img src="docs/assets/logos/postly.png" width="22" alt=""> Postly (live)

Broad multi-platform cloud. OpenAPI: https://docs.postly.ai/openapi.yaml

#### Channels (catalog)

| Family | Channels |
|---|---|
| Social | Instagram, Facebook, LinkedIn, X, Threads, TikTok, YouTube, Pinterest, Bluesky, Google Business Profile |
| Messaging | Telegram, WhatsApp |
| Blog | WordPress, Ghost, Hashnode, Dev.to, Blogger |
| Email | Email (+ providers) |
| Docs-only | Reddit |

Live targets: `POSTLY_TARGET_PLATFORMS` (`identifier:id`). `POSTLY_AUDIENCE_GROUP` unused by default publish.

#### Notion property contract (case-sensitive, live)

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
| `Universal First Comment` | Rich text | First-comment when supported |
| `Video` / `GIF` / `Screenshot` | Files & media | Media (priority: Video → GIF → Screenshot) |

**Optional future overrides (catalog-ready, not required today):** `X Post`, `Bluesky Post`, `Telegram Post`, `WhatsApp Post`.

**Outputs:** `Status`, `Instagram Status`, `Instagram URL`, `Post ID`, `Postly Error`.

**Targeting:** `?target=0` / `?target=0,2`. **Polling:** backoff `[30s, 10s, 20s, 30s, 40s, 50s, 60s]`. **Queue:** `POSTLY_QUEUE_ENABLED=true`.

---

### <img src="docs/assets/logos/typefully.png" width="22" alt=""> Typefully (stub)

Cheaper **text-first** path with strong per-account granularity. Env: `TYPEFULLY_API_KEY`.

#### Channels

| Channel | Suggested override field |
|---|---|
| X (Twitter) | `Typefully Body` (default) |
| LinkedIn | `Typefully LinkedIn` (optional) |
| Threads | `Typefully Threads` (optional) |
| Mastodon | `Typefully Mastodon` (optional) |
| Bluesky | `Typefully Bluesky` (optional) |

#### Suggested Notion fields

| Property | Type | Role |
|---|---|---|
| `Typefully Body` | Rich text | Primary draft / thread start |
| `Typefully Thread` | Rich text | Multi-tweet / thread continuation |
| `Typefully Account` | Rich text / select | Which connected account |
| `Typefully Publish Status` | Status | Output |
| `Typefully URL` | URL | Output |

Media: usually text-only; optional shared `Image` when the channel supports it. Tag `Source Tags` → `Typefully`.

---

### <img src="docs/assets/logos/postiz.png" width="22" alt=""> Postiz (stub)

Widest scheduler surface. Prefer **self-hosted** over expensive cloud. Env: `POSTIZ_API_KEY`.

#### Channels → suggested Notion fields

Global: `Postiz Caption` (rich text) + shared `Video` / `Image` / `GIF`.

| Channel | Suggested override |
|---|---|
| X / Twitter | `Postiz X` |
| Instagram | `Postiz Instagram` |
| Facebook | `Postiz Facebook` |
| LinkedIn | `Postiz LinkedIn` |
| TikTok | `Postiz TikTok` |
| YouTube | `Postiz YouTube` |
| Threads | `Postiz Threads` |
| Mastodon | `Postiz Mastodon` |
| Bluesky | `Postiz Bluesky` |
| Pinterest | `Postiz Pinterest` |
| Reddit | `Postiz Reddit` |
| Telegram | `Postiz Telegram` |
| Discord | `Postiz Discord` |
| Slack | `Postiz Slack` |
| Google Business | `Postiz Google` |

| Property | Type | Role |
|---|---|---|
| `Postiz Caption` | Rich text | Default caption for all selected channels |
| `Postiz Targets` | Multi-select | Subset of channels above |
| `Postiz Publish Status` | Status | Output |
| `Postiz URLs` | Rich text / URL | Output (per-channel lines) |

Tag `Source Tags` → `Postiz`. Full matrix also in [CAPABILITIES.md](./CAPABILITIES.md).

---

## <img src="docs/assets/logos/once.png" width="22" alt=""> ONCE.app (stub, music / podcast)

DSP distribution. Env: `ONCE_API_KEY`.

**Channels:** DSP storefronts via ONCE (music + podcast).

#### Suggested Notion fields

| Property | Type | Role |
|---|---|---|
| `ONCE Title` | Rich text | Track / episode title (or `Name`) |
| `ONCE Audio` | Files & media | Master audio (or shared `Audio`) |
| `ONCE Artwork` | Files & media | Cover art (or shared `Image`) |
| `ONCE Metadata` | Rich text | JSON or credits / ISRC notes |
| `ONCE Publish Status` | Status | Output |
| `ONCE URL` | URL | Output |

Tag `Source Tags` → `ONCE`.

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

SKOOL_API_KEY=sk_live_xxxxxxxxxxxx
SKOOL_GROUP_ID=

GITHUB_TOKEN=
TYPEFULLY_API_KEY=
POSTIZ_API_KEY=
ONCE_API_KEY=
LUMA_API_KEY=
```

Full knobs: [`.env.example`](./.env.example). Matrices: [CAPABILITIES.md](./CAPABILITIES.md).

### Scripts

```bash
npm run build && npm run dev
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
