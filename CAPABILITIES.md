# Publisher Capability Kit

**Notion is the CMS.** Repo: [`Nucleo-Lab/notion-publisher`](https://github.com/Nucleo-Lab/notion-publisher).

| Layer | Distributors |
|---|---|
| **Events** | <img src="docs/assets/logos/luma.png" width="16" alt=""> Luma (**stub**) |
| **Products** | <img src="docs/assets/logos/gumroad.png" width="16" alt=""> Gumroad (**live**), <img src="docs/assets/logos/github.png" width="16" alt=""> GitHub (**stub**), <img src="docs/assets/logos/skool.png" width="16" alt=""> Skool / MySkool (**discover**) |
| **Social** | <img src="docs/assets/logos/postly.png" width="16" alt=""> Postly (**live**), <img src="docs/assets/logos/typefully.png" width="16" alt=""> Typefully (**stub**), <img src="docs/assets/logos/postiz.png" width="16" alt=""> Postiz (**stub**) |
| **Music / Podcast** | <img src="docs/assets/logos/once.png" width="16" alt=""> ONCE.app (**stub**) |

Notion shared schema + per-source field maps: **[README.md](./README.md#notion-db-setup--shared-fields)**.

| Status | Meaning |
|---|---|
| **live** | Publish path wired today |
| **discover** | API readable; no publish webhook yet |
| **stub** | Mapped only |

Self-check: `npm run capabilities:check`

## Distributors

| | ID | Layer | Status | Site |
|---|---|---|---|---|
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

| Channel | Suggested Notion field |
|---|---|
| X | `Typefully Body` |
| LinkedIn | `Typefully LinkedIn` |
| Threads | `Typefully Threads` |
| Mastodon | `Typefully Mastodon` |
| Bluesky | `Typefully Bluesky` |

Plus `Typefully Thread`, `Typefully Account`.

### Postiz (stub — prefer self-hosted)

| Channel | Suggested Notion field |
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

Global: `Postiz Caption` + `Postiz Targets` (multi-select) + shared media.

### Luma / GitHub / Skool / ONCE

See README per-source Notion contracts (event fields, Releases, group posts, audio/artwork).

## Code map

- Registry: `src/capabilities/registry.ts`
- Postly catalog: `src/services/postly-platforms.catalog.ts`
- Skool client: `src/services/skool.service.ts`
- Logos: `docs/assets/logos/`

## Roadmap

1. Skool discover ← current  
2. Skool write · GitHub Releases · Typefully / Postiz / ONCE / Luma clients  
3. Optional Postly `audience_group` opt-in
