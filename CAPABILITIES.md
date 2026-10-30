# Publisher Capability Kit

<img src="docs/assets/logos/notion.png" width="22" alt=""> **Notion is the CMS.** Repo: [`crafter-station/notion-publisher`](https://github.com/crafter-station/notion-publisher).

| Layer | Surfaces |
|---|---|
| **CMS** | <img src="docs/assets/logos/notion.png" width="16" alt=""> Notion (**live** — source of truth) |
| **Events** | <img src="docs/assets/logos/luma.png" width="16" alt=""> Luma (**live** · dry-run), <img src="docs/assets/logos/eventbrite.png" width="16" alt=""> Eventbrite via Composio (**live** · dry-run), Restream (**live** · dry-run only) |
| **Products** | <img src="docs/assets/logos/gumroad.png" width="16" alt=""> Gumroad (**live** · dry-run), <img src="docs/assets/logos/github.png" width="16" alt=""> GitHub (**live** · dry-run · TheVeller Releases), <img src="docs/assets/logos/skool.png" width="16" alt=""> Skool/MySkool (**discover**) |
| **Social** | <img src="docs/assets/logos/postly.png" width="16" alt=""> Postly (**live** · dry-run), <img src="docs/assets/logos/composio.png" width="16" alt=""> Composio (**live** · Reddit), <img src="docs/assets/logos/typefully.png" width="16" alt=""> Typefully (**live** · dry-run), <img src="docs/assets/logos/postiz.png" width="16" alt=""> Postiz (**live** · dry-run) |
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
| <img src="docs/assets/logos/luma.png" width="18" alt=""> | `luma` | Events | **live** · dry-run | [luma.com](https://luma.com/) |
| <img src="docs/assets/logos/gumroad.png" width="18" alt=""> | `gumroad` | Products | **live** · dry-run | [gumroad.com](https://gumroad.com/) |
| <img src="docs/assets/logos/github.png" width="18" alt=""> | `github` | Products | **live** · dry-run | [github.com](https://github.com/) |
| <img src="docs/assets/logos/skool.png" width="18" alt=""> | `myskool` | Products | **discover** | [myskool.xyz](https://myskool.xyz/) |
| <img src="docs/assets/logos/postly.png" width="18" alt=""> | `postly` | Social | **live** · dry-run | [postly.ai](https://postly.ai/) |
| <img src="docs/assets/logos/composio.png" width="18" alt=""> | `composio` | Social + Events | **live** · Reddit + Eventbrite | [composio.dev](https://composio.dev/) |
| <img src="docs/assets/logos/typefully.png" width="18" alt=""> | `typefully` | Social | **live** · dry-run | [typefully.com](https://typefully.com/) |
| <img src="docs/assets/logos/postiz.png" width="18" alt=""> | `postiz` | Social | **live** · dry-run | [postiz.com](https://postiz.com/) |
| <img src="docs/assets/logos/once.png" width="18" alt=""> | `once` | Music | stub | [beta.once.app](https://beta.once.app/) |
| | `restream` | Events | **live** · dry-run only | [restream.io](https://restream.io/) |

## Discovery endpoints

| Method | Path |
|---|---|
| `GET` | `/capabilities` |
| `GET` | `/capabilities/postly` |
| `GET` | `/capabilities/skool` |
| `GET` | `/capabilities/github` |
| `GET` | `/capabilities/composio` |
| `GET` | `/capabilities/postiz` |
| `GET` | `/capabilities/typefully` |
| `GET` | `/capabilities/restream` |

### Postly (live · dry-run default)

One Notion `Image` files property is a **carousel**. Slide order is the files array, then a numeric filename prefix (`01-hook.jpg`) when present. The same ordered set goes to every network. Dry-run returns `accepted` / `trimmed` / `rejected` per network instead of dropping slides silently.

| Network | Carousel rule |
|---|---|
| Instagram | Up to 20, **JPEG only** |
| Facebook | Up to 10 |
| X / Bluesky | Max 4 |
| Pinterest | 2 to 5 |
| LinkedIn | `File` PDF as `content_type: document`; otherwise images as `regular` |

| Family | Identifiers |
|---|---|
| social | `instagram`, `facebook`, `linkedin`, `x`, `threads`, `tiktok`, `youtube`, `pinterest`, `bluesky`, `googleMyBusiness` |
| messaging | `telegram`, `whatsapp` |
| blog | `wordpress`, `ghost`, `hashnode`, `devTo`, `blogger` |
| email | `email` (+ providers) |
| docs_only | `reddit` (**do not publish via Postly** — use Composio + `Channels`∋`Reddit`) |

### Composio (live · Reddit + Eventbrite · dry-run default)

Source Tag **`Composio`**. `POST /webhooks/publish-composio` (`?kind=self|link`, dry-run default; `?live=true` + `COMPOSIO_PUBLISH_LIVE=true` + `resolveLiveGate` to execute). Discover: `GET /capabilities/composio`.

- Reddit: `REDDIT_CREATE_REDDIT_POST`
- Eventbrite: `EVENTBRITE_CREATE_EVENT` (create only; no publish-event / tickets)

Env: `COMPOSIO_API_KEY`, `COMPOSIO_USER_ID`, `COMPOSIO_CONNECTED_ACCOUNT_ID`, `COMPOSIO_REDDIT_SUBREDDIT`, `COMPOSIO_EVENTBRITE_ORGANIZATION_ID`, `COMPOSIO_EVENTBRITE_CONNECTED_ACCOUNT_ID`, `COMPOSIO_EVENTBRITE_CURRENCY`, `COMPOSIO_PUBLISH_LIVE`.

| Property | Role |
|---|---|
| `Composio Publish Status` / `Composio URL` | Source writebacks |
| `Reddit Title` / `Body` / `Subreddit` / `Link URL` / `Reddit URL` | Reddit channel |
| `Composio User ID` / `Composio Connected Account ID` | optional multi-account overrides |
| `Eventbrite Title` / `Start` / `End` / `Organization ID` / `Currency` / `Online` | Eventbrite create |

### Typefully (live · dry-run default)

Public API v2 drafts: `Authorization: Bearer $TYPEFULLY_API_KEY` → `POST /v2/social-sets/{social_set_id}/drafts`. Client: `src/services/typefully.service.ts`. Webhook: `POST /webhooks/publish-typefully`. Discover: `GET /capabilities/typefully`.

Dry-run is the default. **Never sends `publish_at`** (draft or `plan_at` only). Live needs `TYPEFULLY_PUBLISH_LIVE=true`. Platforms: X, LinkedIn, Threads, Mastodon, Bluesky.

Env: `TYPEFULLY_API_KEY`, `TYPEFULLY_SOCIAL_SET_ID`.

### Postiz (live · dry-run default — prefer self-hosted)

Public API: `Authorization: $POSTIZ_API_KEY` → `POST {POSTIZ_API_BASE}/posts`. Client: `src/services/postiz.service.ts`. Webhook: `POST /webhooks/publish-postiz`. Discover: `GET /capabilities/postiz`.

Dry-run is the default (exact payload, **no** create). Live needs `POSTIZ_PUBLISH_LIVE=true` and `?live=true`. Immediate `type=now` is never sent. Prefer self-hosted `POSTIZ_API_BASE` — no paid cloud plan assumed.

Wired write channels: **Discord, Slack, Mastodon, Skool, Twitch, Kick, Warpcast, Nostr, Lemmy, Listmonk**. Skool here is Postiz's provider (not MySkool write).

Env: `POSTIZ_API_KEY`, optional `POSTIZ_API_BASE`, `POSTIZ_INTEGRATIONS`, `POSTIZ_DISCORD_CHANNEL`, `POSTIZ_SLACK_CHANNEL`, `POSTIZ_SKOOL_GROUP`, `POSTIZ_SKOOL_LABEL`, `POSTIZ_LISTMONK_LIST`.

### ONCE.app (stub — music / podcast DSP)

Documented destinations: **Spotify**, **Apple Music**, **YouTube Music**, **Amazon Music**, **Tidal**, **Deezer**, **Pandora**, plus other DSPs via the ONCE network.

Notion: `ONCE Title`, `ONCE Audio`, `ONCE Artwork`, `ONCE Metadata`, `ONCE Targets` (multi-select of the majors above).

### Restream (live · dry-run only)

Create/schedule only: `POST https://api.restream.io/v2/user/events/new` (`streamType` studio|encoder|file). Client: `src/services/restream.service.ts`. Webhook: `POST /webhooks/publish-restream`. Discover: `GET /capabilities/restream`.

Always dry-run — never calls Restream, never go-live. StreamYard excluded. Looping is a paid feature and is rejected. Env: `RESTREAM_ACCESS_TOKEN` (optional for dry-run), `RESTREAM_CLIENT_ID`, `RESTREAM_CLIENT_SECRET`, `RESTREAM_REFRESH_TOKEN`.

### Luma (live · dry-run default)

Env: `LUMA_API_KEY`, `LUMA_PUBLISH_LIVE` · webhook `POST /webhooks/publish-luma` · client `src/services/luma.service.ts`.

Dry-run is the default (`resolveLiveGate` + `LUMA_PUBLISH_LIVE=true`). No Luma call until both are live.

Creates event from `Luma Title` / `Luma Start` (+ optional End / Location / Description / **Cover** via CDN upload). Writeback: `Luma Publish Status`, `Luma Event URL`. Update / tickets = out of v1.

Import mirror: `npm run luma:import-tnc`.

Ngrok checklist: see README Luma section (button → `/webhooks/publish-luma`).

### GitHub (live · dry-run default)

Env: `GITHUB_TOKEN`, `GITHUB_PUBLISH_LIVE` · webhook `POST /webhooks/publish-github` · product owner **TheVeller** only.

Dry-run is the default (`resolveLiveGate` + `GITHUB_PUBLISH_LIVE=true`). No Release is created until both are live. If a live call reaches the use-case without `draft:false`, the Release stays a GitHub draft (`options.draft ?? true`).

Catalog: `GET /capabilities/github` · `npm run github:import-repos -- --owner=TheVeller`. Releases refuse non-TheVeller owners ([#5](https://github.com/crafter-station/notion-publisher/issues/5)). Ngrok checklist: README GitHub section.

### Webhook auth

Every `POST /webhooks/*` requires `Authorization: Bearer $WEBHOOK_TOKEN` (at least 32 characters, constant-time compare). The HTTP server exits on boot if the token is missing or short. `GET /capabilities*` is unchanged.

### Live flags (`*_PUBLISH_LIVE`)

Today the per-connector `*_PUBLISH_LIVE` flags do **not** activate a live provider call on their own.

Alias webhooks call `resolveConnectorLiveGate(env.*_PUBLISH_LIVE)` without `cuentaEstado`, `publicacionModo`, or `canalEstadoDelConector`. `resolveLiveGate` in [`src/connectors/live-gate.ts`](./src/connectors/live-gate.ts) (the checks around lines 68–76) then always returns dry-run (`global_flag_off`, or `cuenta_not_activa:empty` if `CONTENT_OS_PUBLISH_LIVE=true`).

This is intentionally safe. Passing those Content OS values from Notion into the alias-webhook gate is future work — not implemented.

`POST /webhooks/unpublish-gumroad` uses the same gate as `POST /webhooks/publish-gumroad` (`GUMROAD_PUBLISH_LIVE` + `resolveLiveGate`). Dry-run never calls `gumroad.unpublish()`.

### Skool (discover)

Discover via `GET /capabilities/skool`; write blocked on MySkool `POST /v1/posts` ([#4](https://github.com/crafter-station/notion-publisher/issues/4)). Key must be `sk_live_…`.

## Code map

- Registry: `src/capabilities/registry.ts`
- Postly catalog: `src/services/postly-platforms.catalog.ts`
- Skool client: `src/services/skool.service.ts`
- Luma client: `src/services/luma.service.ts`
- GitHub client: `src/services/github.service.ts`
- Restream client: `src/services/restream.service.ts`
- Logos: `docs/assets/logos/` (incl. channel favicons)
- Channel SSOT grid: [README.md](./README.md#channel-grid-all-destinations)

## Roadmap

SSOT: **[docs/PROGRESS.md](./docs/PROGRESS.md)** · [repo](https://github.com/crafter-station/notion-publisher) · [issues](https://github.com/crafter-station/notion-publisher/issues)

- **Completed:** milestone Shipped (#12–#14) · Luma (#9) · GitHub TheVeller (#5) · Composio Reddit live
- **Next:** Phase A leftovers (#3)
- **Later:** Skool write (#4, blocked); ONCE
