# Publisher Capability Kit

<img src="docs/assets/logos/notion.png" width="22" alt=""> **Notion is the CMS.** Repo: [`Nucleo-Lab/notion-publisher`](https://github.com/Nucleo-Lab/notion-publisher).

| Layer | Surfaces |
|---|---|
| **CMS** | <img src="docs/assets/logos/notion.png" width="16" alt=""> Notion (**live** — source of truth) |
| **Events** | <img src="docs/assets/logos/luma.png" width="16" alt=""> Luma (**live**), <img src="docs/assets/logos/eventbrite.png" width="16" alt=""> Eventbrite via Composio (**stub**) |
| **Products** | <img src="docs/assets/logos/gumroad.png" width="16" alt=""> Gumroad (**live**), <img src="docs/assets/logos/github.png" width="16" alt=""> GitHub (**live** · TheVeller), <img src="docs/assets/logos/skool.png" width="16" alt=""> Skool / MySkool (**discover**) |
| **Social** | <img src="docs/assets/logos/postly.png" width="16" alt=""> Postly (**live**), <img src="docs/assets/logos/composio.png" width="16" alt=""> Composio (**stub** · Reddit), <img src="docs/assets/logos/typefully.png" width="16" alt=""> Typefully (**stub**), <img src="docs/assets/logos/postiz.png" width="16" alt=""> Postiz (**stub**) |
| **Music / Podcast** | <img src="docs/assets/logos/once.png" width="16" alt=""> ONCE.app (**stub**) |

**CMS contract (SSOT):** one Notion DB `Publisher`, views filtered by `Source Tags`, shared `Caption`/`Video`/`Image` + optional channel overrides → **[README.md](./README.md#notion-db-setup--one-database-views-by-source)**.

| Status | Meaning |
|---|---|
| **live** | Publish path wired today (or CMS in production use) |
| **discover** | API readable; no publish webhook yet |
| **stub** | Mapped only |

Self-check: `npm run capabilities:check`

## Distributors

| | ID | Layer | Status | Site |
|---|---|---|---|---|
| <img src="docs/assets/logos/notion.png" width="18" alt=""> | `notion` *(CMS)* | CMS | **live** | [notion.so](https://www.notion.so/) |
| <img src="docs/assets/logos/luma.png" width="18" alt=""> | `luma` | Events | **live** | [luma.com](https://luma.com/) |
| <img src="docs/assets/logos/gumroad.png" width="18" alt=""> | `gumroad` | Products | **live** | [gumroad.com](https://gumroad.com/) |
| <img src="docs/assets/logos/github.png" width="18" alt=""> | `github` | Products | **live** | [github.com](https://github.com/) |
| <img src="docs/assets/logos/skool.png" width="18" alt=""> | `myskool` | Products | **discover** | [myskool.xyz](https://myskool.xyz/) |
| <img src="docs/assets/logos/postly.png" width="18" alt=""> | `postly` | Social | **live** | [postly.ai](https://postly.ai/) |
| <img src="docs/assets/logos/composio.png" width="18" alt=""> | `composio` | Social + Events | stub | [composio.dev](https://composio.dev/) |
| <img src="docs/assets/logos/typefully.png" width="18" alt=""> | `typefully` | Social | stub | [typefully.com](https://typefully.com/) |
| <img src="docs/assets/logos/postiz.png" width="18" alt=""> | `postiz` | Social | stub | [postiz.com](https://postiz.com/) |
| <img src="docs/assets/logos/once.png" width="18" alt=""> | `once` | Music | stub | [beta.once.app](https://beta.once.app/) |

## Discovery endpoints

| Method | Path |
|---|---|
| `GET` | `/capabilities` |
| `GET` | `/capabilities/postly` |
| `GET` | `/capabilities/skool` |
| `GET` | `/capabilities/github` |

### Postly (live)

| Family | Identifiers |
|---|---|
| social | `instagram`, `facebook`, `linkedin`, `x`, `threads`, `tiktok`, `youtube`, `pinterest`, `bluesky`, `googleMyBusiness` |
| messaging | `telegram`, `whatsapp` |
| blog | `wordpress`, `ghost`, `hashnode`, `devTo`, `blogger` |
| email | `email` (+ providers) |
| docs_only | `reddit` (**do not publish via Postly** — use Composio + `Channels`∋`Reddit`) |

### Composio (stub)

Source Tag **`Composio`**. Transport for **Reddit** (Social) and **Eventbrite** (Events channel — not a Source Tag). Shared Notion view with Typefully: `Social — Composio / Typefully`. Events: `Events — All` includes Composio+Eventbrite. Env: `COMPOSIO_API_KEY` (not wired). No write webhook yet.

### Typefully (stub)

Shared `Caption` + optional channel overrides (empty → `Caption`). Plus `Typefully Thread`, `Typefully Account`. See [README Social model](./README.md#social--shared-media--optional-channel-overrides).

| Channel | Suggested Notion field |
|---|---|
| X | `X Post` / `Twitter Post` |
| LinkedIn | `LinkedIn Post` |
| Threads | `Twitter Post` |
| Mastodon | `Typefully Mastodon` |
| Bluesky | `Typefully Bluesky` |

### Postiz (stub — prefer self-hosted)

Source: [`postiz-app` social providers](https://github.com/gitroomhq/postiz-app/tree/main/libraries/nestjs-libraries/src/integrations/social).

| Family | Channels |
|---|---|
| Social | X, Instagram (+ standalone), Facebook, LinkedIn (+ Page), TikTok, YouTube, Threads, Pinterest, Reddit, Bluesky, Mastodon (+ custom), Tumblr, VK, MeWe |
| Communities / forums | Lemmy, Skool, Whop, Farcaster, Nostr |
| Messaging | Telegram, Discord, Slack |
| Live / creator | Twitch, Kick |
| Design | Dribbble |
| Blog / newsletters | Medium, Dev.to, Hashnode, WordPress, Listmonk |
| Local | Google Business (GMB) |

Notion: shared `Caption` + `Postiz Targets` + optional `Postiz {Channel}` overrides (see [README](./README.md)).

### ONCE.app (stub — music / podcast DSP)

Documented destinations: **Spotify**, **Apple Music**, **YouTube Music**, **Amazon Music**, **Tidal**, **Deezer**, **Pandora**, plus other DSPs via the ONCE network.

Notion: `ONCE Title`, `ONCE Audio`, `ONCE Artwork`, `ONCE Metadata`, `ONCE Targets` (multi-select of the majors above).

### Luma (live)

Env: `LUMA_API_KEY` · webhook `POST /webhooks/publish-luma` · client `src/services/luma.service.ts`.

Creates event from `Luma Title` / `Luma Start` (+ optional End / Location / Description / **Cover** via CDN upload). Writeback: `Luma Publish Status`, `Luma Event URL`. Update / tickets = out of v1.

Import mirror: `npm run luma:import-tnc`.

Ngrok checklist: see README Luma section (button → `/webhooks/publish-luma`).

### GitHub (live)

Env: `GITHUB_TOKEN` · webhook `POST /webhooks/publish-github` · product owner **TheVeller** only.

Catalog: `GET /capabilities/github` · `npm run github:import-repos -- --owner=TheVeller`. Releases refuse non-TheVeller owners ([#5](https://github.com/Nucleo-Lab/notion-publisher/issues/5)). Ngrok checklist: README GitHub section.

### Skool (discover)

Discover via `GET /capabilities/skool`; write blocked on MySkool `POST /v1/posts` ([#4](https://github.com/Nucleo-Lab/notion-publisher/issues/4)). Key must be `sk_live_…`.

## Code map

- Registry: `src/capabilities/registry.ts`
- Postly catalog: `src/services/postly-platforms.catalog.ts`
- Skool client: `src/services/skool.service.ts`
- Luma client: `src/services/luma.service.ts`
- GitHub client: `src/services/github.service.ts`
- Logos: `docs/assets/logos/` (incl. channel favicons)
- Channel SSOT grid: [README.md](./README.md#channel-grid-all-destinations)

## Roadmap

SSOT: **[docs/PROGRESS.md](./docs/PROGRESS.md)** · [Project](https://github.com/orgs/Nucleo-Lab/projects/2) · [issues](https://github.com/Nucleo-Lab/notion-publisher/issues)

- **Completed:** milestone Shipped (#12–#14) · Luma (#9) · GitHub TheVeller (#5) · channel mega-grid + Composio stub taxonomy
- **Next:** Composio discover/auth (Reddit / Eventbrite); Phase A leftovers (#3)
- **Later:** Typefully write (#6); Skool write (#4, blocked); Postiz / ONCE
