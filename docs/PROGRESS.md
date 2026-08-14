# Progress + backlog

How to read this file: **completed work first** (Gumroad + Postly), then what’s live, then what’s left.

| Layer | Link |
|---|---|
| **Project** | [Nucleo-Lab/projects/2 — notion-publisher](https://github.com/orgs/Nucleo-Lab/projects/2) |
| **Issues** | [Nucleo-Lab/notion-publisher/issues](https://github.com/Nucleo-Lab/notion-publisher/issues) |
| **Milestones** | Shipped · Phase A CMS · Phase B Products · Phase C Social · Phase D Events/Music |

Tracking model: **Project** (board) → **Milestones** (phases) → **Issues** (work units).

Do **not** invent publish webhooks for stub/discover connectors.  
**Do not start Skool write (#4)** until completed live work is clearly tracked (this section) and Phase A CMS hygiene is in motion. #4 stays **blocked** on MySkool upstream anyway.

---

## What this repo does

**Notion is the CMS.** This service (`notion-publisher`) turns Notion rows + automations into publishes across layers:

Events → Products → Social → Music/Podcast.

---

## Completed (closed issues) — start here

These are **shipped**. Closed on GitHub with label `status:done`.

| Issue | Layer | What shipped |
|---|---|---|
| [#12](https://github.com/Nucleo-Lab/notion-publisher/issues/12) *(closed)* | Products | **Gumroad live** — publish/unpublish webhooks, Notion contract, autopilot, visuals, markdown→HTML |
| [#13](https://github.com/Nucleo-Lab/notion-publisher/issues/13) *(closed)* | Social | **Postly live** — multi-platform webhook, per-platform captions, media, queue, `GET /capabilities/postly` |
| [#14](https://github.com/Nucleo-Lab/notion-publisher/issues/14) *(closed)* | Products | **Skool discover only** — MySkool read client + `GET /capabilities/skool` (**not** write; write = #4 blocked) |
| [#2](https://github.com/Nucleo-Lab/notion-publisher/issues/2) *(closed)* | CMS/Social | **Caption** preferred; `POV Text` legacy fallback (PR [#15](https://github.com/Nucleo-Lab/notion-publisher/pull/15)) |
| [#1](https://github.com/Nucleo-Lab/notion-publisher/issues/1) *(closed)* | CMS | **One Publisher DB** — AI POVs renamed+extended; 163 Gumroad rows migrated; env IDs unified; inventory in [`notion-schema-inventory.md`](./notion-schema-inventory.md) |
| [#5](https://github.com/Nucleo-Lab/notion-publisher/issues/5) *(closed)* | Products | **GitHub live** — catalog import + Releases under **TheVeller** only; asset from Template/File; `POST /webhooks/publish-github` |

Open follow-ups on the live stack (not “not done”, just next polish):

- Postly naming (2026-08-13): `Instagram Status/URL` → `Postly Publish Status` / `Postly URL`; aggregate `Postly Error` → `Error` (see [`notion-property-map.md`](./notion-property-map.md))
- Postly: [#10](https://github.com/Nucleo-Lab/notion-publisher/issues/10) audience_group · [#11](https://github.com/Nucleo-Lab/notion-publisher/issues/11) expand targets  
- Skool **write**: [#4](https://github.com/Nucleo-Lab/notion-publisher/issues/4) — **blocked** on MySkool POST; do this **after** Phase A, not instead of documenting #12/#13

---

## Live today

| Layer | Surface | Status | Issue |
|---|---|---|---|
| CMS | Notion `Publisher` (one DB) | **live** | [#1](https://github.com/Nucleo-Lab/notion-publisher/issues/1) |
| Products | Gumroad | **live** | [#12](https://github.com/Nucleo-Lab/notion-publisher/issues/12) |
| Social | Postly | **live** | [#13](https://github.com/Nucleo-Lab/notion-publisher/issues/13) |
| Products | Skool / MySkool | **discover** (key in `.env`; smoke 401 until valid `sk_live_…`) | [#14](https://github.com/Nucleo-Lab/notion-publisher/issues/14) · write [#4](https://github.com/Nucleo-Lab/notion-publisher/issues/4) blocked |
| Events | Luma | **live** (`POST /webhooks/publish-luma`) | [#9](https://github.com/Nucleo-Lab/notion-publisher/issues/9) |
| Products | GitHub | **live** (catalog + Releases under **TheVeller** only) | [#5](https://github.com/Nucleo-Lab/notion-publisher/issues/5) |

Everything else in the kit is **mapped (stub)** — docs + registry, no publish client yet.

---

## Also done (kit + docs, no separate issue)

| Done | Notes |
|---|---|
| Capability registry | `src/capabilities/registry.ts` · `npm run capabilities:check` |
| Discovery HTTP | `GET /capabilities` (+ postly / skool / github) |
| Stub maps + logos | Typefully, Postiz, ONCE |
| GitHub catalog + Releases | `github.service` + import script + `/webhooks/publish-github` (TheVeller only) |
| Luma create webhook | `luma.service` + cover CDN upload + `/webhooks/publish-luma` + Notion writeback |
| Luma TNC import | `npm run luma:import-tnc` — five Aug-29 The Next Craft mirrored to Publisher |
| Repo rename | `notion-publisher` under Nucleo Lab |
| CMS contract docs | One DB `Publisher`, views by **Layer** + `Source Tags`, Social shared `Caption`/media + overrides |
| Publisher unify cutover | Schema + row migration + env triple-ID; archive old Templates DB |
| Postly output rename | `Postly Publish Status` / `Postly URL`; Status option `Error`; Notion API stays `2022-06-28` |

---

## Backlog by phase

### Status labels (important)

| Label | Issue state | Meaning |
|---|---|---|
| `status:done` | **CLOSED** | Ya hecho / shipped (#12 Gumroad, #13 Postly, #14 Skool discover, #2 Caption, #1 Publisher unify) |
| `status:next` | OPEN | Siguiente — se puede empezar (**no** significa “completado”) |
| `status:blocked` | OPEN | Esperando a terceros (#4 MySkool write) |
| `status:later` | OPEN | Backlog después de Phase A |

`status:ready` was retired — too easy to read as Spanish “listo” = done.

### Phase A — CMS hygiene

| Issue | Status | In plain words |
|---|---|---|
| [#1](https://github.com/Nucleo-Lab/notion-publisher/issues/1) Migrate live Notion DBs → one Publisher | **done** | Unified; recreate Gumroad buttons + views in Notion UI |
| [#3](https://github.com/Nucleo-Lab/notion-publisher/issues/3) Enable Notion MCP | next | Agents can inspect Publisher schema safely |

### Phase B — Products (after Phase A; Skool write last among these)

| Issue | Status | In plain words |
|---|---|---|
| [#5](https://github.com/Nucleo-Lab/notion-publisher/issues/5) GitHub Releases publish | **done** (ship) | Catalog + create Release under TheVeller; no update/delete |
| [#4](https://github.com/Nucleo-Lab/notion-publisher/issues/4) Skool write via MySkool | **blocked** | Needs upstream write API — **not** the next action after #12/#13 |

### Phase C — Social (clients + Postly opts)

| Issue | Status | In plain words |
|---|---|---|
| [#6](https://github.com/Nucleo-Lab/notion-publisher/issues/6) Typefully client | later | Text drafts/threads from shared Caption model |
| [#7](https://github.com/Nucleo-Lab/notion-publisher/issues/7) Postiz client (self-hosted preferred) | later | Widest scheduler surface |
| [#10](https://github.com/Nucleo-Lab/notion-publisher/issues/10) Postly `audience_group` opt-in | later | Flag off by default |
| [#11](https://github.com/Nucleo-Lab/notion-publisher/issues/11) Expand `POSTLY_TARGET_PLATFORMS` | later | Only when accounts are ready |

### Phase D — Events / Music

| Issue | Status | In plain words |
|---|---|---|
| [#9](https://github.com/Nucleo-Lab/notion-publisher/issues/9) Luma events client | **done (create + cover)** | Create + CDN cover + writeback; update/tickets later |
| [#8](https://github.com/Nucleo-Lab/notion-publisher/issues/8) ONCE.app DSP client | later | Audio distribution to major DSPs |

---

## How to update this file

1. When work **ships**, create/close a GitHub issue with `status:done` and add it under **Completed**.
2. When an open issue ships, close it and move its row into **Completed** or **Also done**.
3. Skool write (#4) only after MySkool write exists — keep it below completed Gumroad/Postly in the story.

---

## Related docs

- [README.md](../README.md) — architecture, Notion schema, per-source contracts  
- [CAPABILITIES.md](../CAPABILITIES.md) — status + channel matrices  
