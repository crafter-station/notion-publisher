# Publisher Capability Kit

**Notion is the CMS.** This repo ([`Nucleo-Lab/notion-publisher`](https://github.com/Nucleo-Lab/notion-publisher)) is the orchestrator — not a UI. Publish channels by layer:

| Layer | Distributors |
|---|---|
| **Events** | <img src="docs/assets/logos/luma.png" width="16" alt=""> Luma (**stub**) |
| **Products** | <img src="docs/assets/logos/gumroad.png" width="16" alt=""> Gumroad (**live**), <img src="docs/assets/logos/github.png" width="16" alt=""> GitHub (**stub**), <img src="docs/assets/logos/skool.png" width="16" alt=""> <img src="docs/assets/logos/myskool.png" width="16" alt=""> Skool / MySkool (**discover**) |
| **Social** | <img src="docs/assets/logos/postly.png" width="16" alt=""> Postly (**live**), <img src="docs/assets/logos/typefully.png" width="16" alt=""> Typefully (**stub**), <img src="docs/assets/logos/postiz.png" width="16" alt=""> Postiz (**stub**) |
| **Music / Podcast** | <img src="docs/assets/logos/once.png" width="16" alt=""> ONCE.app (**stub**) |

Same product can ship to **Gumroad + GitHub + Skool**. Skool also = community.

Social positioning:

- **Postly** — broad multi-channel cloud (live today)
- **Typefully** — cheaper; X / LinkedIn / Threads / Mastodon; strong text-account granularity
- **Postiz** — widest surface; prefer **self-hosted** over expensive cloud

Favicons: [`docs/assets/logos/`](./docs/assets/logos/). Notion property contracts: [README.md](./README.md).

| Status | Meaning |
|---|---|
| **live** | Publish path wired today |
| **discover** | API readable; no publish webhook yet |
| **stub** | Mapped in registry only |

**Current publish path is unchanged.** Gumroad + Postly webhooks behave as before.

Self-check: `npm run capabilities:check`

## Distributors

| | ID | Layer | Kind | Status | Site |
|---|---|---|---|---|---|
| <img src="docs/assets/logos/luma.png" width="18" alt=""> | `luma` | Events | other | stub | [luma.com](https://luma.com/) |
| <img src="docs/assets/logos/gumroad.png" width="18" alt=""> | `gumroad` | Products | marketplace | **live** | [gumroad.com](https://gumroad.com/) |
| <img src="docs/assets/logos/github.png" width="18" alt=""> | `github` | Products | marketplace | stub | [github.com](https://github.com/) |
| <img src="docs/assets/logos/skool.png" width="18" alt=""> | `myskool` | Products | community | **discover** | [myskool.xyz](https://myskool.xyz/) |
| <img src="docs/assets/logos/postly.png" width="18" alt=""> | `postly` | Social | social | **live** | [postly.ai](https://postly.ai/) |
| <img src="docs/assets/logos/typefully.png" width="18" alt=""> | `typefully` | Social | social | stub | [typefully.com](https://typefully.com/) |
| <img src="docs/assets/logos/postiz.png" width="18" alt=""> | `postiz` | Social | social | stub | [postiz.com](https://postiz.com/) |
| <img src="docs/assets/logos/once.png" width="18" alt=""> | `once` | Music | music | stub | [beta.once.app](https://beta.once.app/) |

Legacy ids `nce` / `postis` / `gumroad-published` naming are retired (repo = `notion-publisher`).

## Discovery endpoints (read-only)

| Method | Path | Body |
|---|---|---|
| `GET` | `/capabilities` | Static registry + layers + Postly catalog |
| `GET` | `/capabilities/postly` | Live socials + audience groups |
| `GET` | `/capabilities/skool` | MySkool groups (+ sample posts) or stub message |

```bash
curl -s localhost:3000/capabilities/skool | jq .
```

## Postly platform matrix

| Identifier | Family | Catalog |
|---|---|---|
| `instagram`, `facebook`, `linkedin`, `x`, `threads`, `tiktok`, `youtube`, `pinterest`, `bluesky`, `googleMyBusiness` | social | `api` |
| `telegram`, `whatsapp` | messaging | `api` |
| `wordpress`, `ghost`, `hashnode`, `devTo`, `blogger` | blog | `api` |
| `email` (+ providers) | email | `api` |
| `reddit` | social | `docs_only` |

## Code map

- Registry: `src/capabilities/registry.ts`
- Postly catalog: `src/services/postly-platforms.catalog.ts`
- Postly client: `src/services/postly.service.ts`
- Skool client: `src/services/skool.service.ts`
- Logos: `docs/assets/logos/`

## Roadmap

1. Skool discover ← current
2. Skool write (MySkool Phase 2)
3. GitHub Releases product publish
4. Typefully / Postiz (self-hosted) / ONCE / Luma clients
5. Optional Postly `audience_group` opt-in
