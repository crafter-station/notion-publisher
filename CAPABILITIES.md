# Publisher Capability Kit

<img src="docs/assets/logos/notion.png" width="22" alt=""> **Notion is the CMS.** Repo: [`Nucleo-Lab/notion-publisher`](https://github.com/Nucleo-Lab/notion-publisher).

| Layer | Surfaces |
|---|---|
| **CMS** | <img src="docs/assets/logos/notion.png" width="16" alt=""> Notion (**live** — source of truth) |
| **Events** | <img src="docs/assets/logos/luma.png" width="16" alt=""> Luma (**stub**) |
| **Products** | <img src="docs/assets/logos/gumroad.png" width="16" alt=""> Gumroad (**live**), <img src="docs/assets/logos/github.png" width="16" alt=""> GitHub (**stub**), <img src="docs/assets/logos/skool.png" width="16" alt=""> Skool / MySkool (**discover**) |
| **Social** | <img src="docs/assets/logos/postly.png" width="16" alt=""> Postly (**live**), <img src="docs/assets/logos/typefully.png" width="16" alt=""> Typefully (**stub**), <img src="docs/assets/logos/postiz.png" width="16" alt=""> Postiz (**stub**) |
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
| <img src="docs/assets/logos/luma.png" width="18" alt=""> | `luma` | Events | stub | [luma.com](https://luma.com/) |
| <img src="docs/assets/logos/gumroad.png" width="18" alt=""> | `gumroad` | Products | **live** | [gumroad.com](https://gumroad.com/) |
| <img src="docs/assets/logos/github.png" width="18" alt=""> | `github` | Products | stub | [github.com](https://github.com/) |
| <img src="docs/assets/logos/skool.png" width="18" alt=""> | `myskool` | Products | **discover** | [myskool.xyz](https://myskool.xyz/) |
| <img src="docs/assets/logos/postly.png" width="18" alt=""> | `postly` | Social | **live** | [postly.ai](https://postly.ai/) |
| <img src="docs/assets/logos/typefully.png" width="18" alt=""> | `typefully` | Social | stub | [typefully.com](https://typefully.com/) |
| <img src="docs/assets/logos/postiz.png" width="18" alt=""> | `postiz` | Social | stub | [postiz.com](https://postiz.com/) |
| <img src="docs/assets/logos/once.png" width="18" alt=""> | `once` | Music | stub | [beta.once.app](https://beta.once.app/) |

## Discovery endpoints

| Method | Path |
|---|---|
| `GET` | `/capabilities` |
| `GET` | `/capabilities/postly` |
| `GET` | `/capabilities/skool` |

## Channel matrices

### Postly (live)

| Family | Identifiers |
|---|---|
| social | `instagram`, `facebook`, `linkedin`, `x`, `threads`, `tiktok`, `youtube`, `pinterest`, `bluesky`, `googleMyBusiness` |
| messaging | `telegram`, `whatsapp` |
| blog | `wordpress`, `ghost`, `hashnode`, `devTo`, `blogger` |
| email | `email` (+ providers) |
| docs_only | `reddit` |

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

### Luma / GitHub / Skool

See README per-source Notion contracts (event fields, Releases, group posts).

## Code map

- Registry: `src/capabilities/registry.ts`
- Postly catalog: `src/services/postly-platforms.catalog.ts`
- Skool client: `src/services/skool.service.ts`
- Logos: `docs/assets/logos/`

## Roadmap

1. Skool discover ← current  
2. Skool write · GitHub Releases · Typefully / Postiz / ONCE / Luma clients  
3. Optional Postly `audience_group` opt-in
