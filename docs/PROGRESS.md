# Progress + backlog

SSOT for **shipped vs remaining** on [`Nucleo-Lab/notion-publisher`](https://github.com/Nucleo-Lab/notion-publisher).  
Execution tracker: **GitHub Issues** (Linear not wired this pass).

Do not invent publish webhooks for stub/discover connectors.

---

## Shipped (code + docs)

| Area | What | Notes / refs |
|---|---|---|
| Products | Gumroad **live** publish | Webhooks publish/unpublish; autopilot, visual assets, markdown→HTML descriptions |
| Social | Postly **live** multi-platform | Notion webhooks; per-platform caption overrides; queue/schedulers |
| Kit | Capability registry | `src/capabilities/registry.ts`; `npm run capabilities:check` |
| HTTP | Discovery endpoints | `GET /capabilities`, `/capabilities/postly`, `/capabilities/skool` |
| Products | Skool/MySkool **discover** | Read client; no write until upstream POST |
| Events | Luma **stub** map + logo | Docs + registry only |
| Products | GitHub Releases **stub** map + logo | Docs + registry only |
| Social | Typefully / Postiz **stub** maps + logos | Channel matrices in README / CAPABILITIES |
| Music | ONCE.app **stub** map + logo | DSP destinations documented |
| Repo | Rename → `notion-publisher` | Hosted under Nucleo Lab; old remote kept as `gpt-chain` |
| CMS docs | One DB `Publisher` contract | Views by `Source Tags`; Social A: shared `Caption`/`Video`/`Image` + channel overrides; Notion logo/headers |

Useful commits (recent kit era): `20b4e48` capability kit · `7777d6b` Skool discover + stubs · `621bf72` CMS Social A docs · `0ca68ca` Notion header logo.

**Live publish today:** Gumroad + Postly only.

---

## Remaining (open issues)

| # | Issue | Labels |
|---|---|---|
| [#1](https://github.com/Nucleo-Lab/notion-publisher/issues/1) | Unify production Notion DBs → single `Publisher` | cms, docs |
| [#2](https://github.com/Nucleo-Lab/notion-publisher/issues/2) | Accept `Caption` as alias of `POV Text` in Postly parser | cms, social |
| [#3](https://github.com/Nucleo-Lab/notion-publisher/issues/3) | Install/configure Notion MCP for this project | cms, docs |
| [#4](https://github.com/Nucleo-Lab/notion-publisher/issues/4) | Skool write when MySkool `POST /v1/posts` ships | products |
| [#5](https://github.com/Nucleo-Lab/notion-publisher/issues/5) | GitHub Releases product publish client | products |
| [#6](https://github.com/Nucleo-Lab/notion-publisher/issues/6) | Typefully social client | social |
| [#7](https://github.com/Nucleo-Lab/notion-publisher/issues/7) | Postiz client (prefer self-hosted) | social |
| [#8](https://github.com/Nucleo-Lab/notion-publisher/issues/8) | ONCE.app music/podcast client | music |
| [#9](https://github.com/Nucleo-Lab/notion-publisher/issues/9) | Luma events client | events |
| [#10](https://github.com/Nucleo-Lab/notion-publisher/issues/10) | Optional Postly `audience_group` on live publish path | social |
| [#11](https://github.com/Nucleo-Lab/notion-publisher/issues/11) | Expand `POSTLY_TARGET_PLATFORMS` toward catalog | social |

---

## Suggested order

1. CMS hygiene: [#1](https://github.com/Nucleo-Lab/notion-publisher/issues/1) · [#2](https://github.com/Nucleo-Lab/notion-publisher/issues/2) · [#3](https://github.com/Nucleo-Lab/notion-publisher/issues/3)
2. Products next: [#4](https://github.com/Nucleo-Lab/notion-publisher/issues/4) (blocked on MySkool write) · [#5](https://github.com/Nucleo-Lab/notion-publisher/issues/5)
3. Social clients: [#6](https://github.com/Nucleo-Lab/notion-publisher/issues/6) · [#7](https://github.com/Nucleo-Lab/notion-publisher/issues/7) · [#10](https://github.com/Nucleo-Lab/notion-publisher/issues/10) · [#11](https://github.com/Nucleo-Lab/notion-publisher/issues/11)
4. Events / music: [#9](https://github.com/Nucleo-Lab/notion-publisher/issues/9) · [#8](https://github.com/Nucleo-Lab/notion-publisher/issues/8)

When an issue ships: close it and move the row into **Shipped** above.

---

## Related docs

- [README.md](../README.md) — architecture, Notion schema, per-source contracts  
- [CAPABILITIES.md](../CAPABILITIES.md) — status matrix + channel matrices  
