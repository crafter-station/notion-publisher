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

Open follow-ups on the live stack (not “not done”, just next polish):

- Postly: [#10](https://github.com/Nucleo-Lab/notion-publisher/issues/10) audience_group · [#11](https://github.com/Nucleo-Lab/notion-publisher/issues/11) expand targets  
- Skool **write**: [#4](https://github.com/Nucleo-Lab/notion-publisher/issues/4) — **blocked** on MySkool POST; do this **after** Phase A, not instead of documenting #12/#13

---

## Live today

| Layer | Surface | Status | Issue |
|---|---|---|---|
| CMS | Notion | live | (source of truth) |
| Products | Gumroad | **live** | [#12](https://github.com/Nucleo-Lab/notion-publisher/issues/12) |
| Social | Postly | **live** | [#13](https://github.com/Nucleo-Lab/notion-publisher/issues/13) |
| Products | Skool / MySkool | **discover** | [#14](https://github.com/Nucleo-Lab/notion-publisher/issues/14) |

Everything else in the kit is **mapped (stub)** — docs + registry, no publish client yet.

---

## Also done (kit + docs, no separate issue)

| Done | Notes |
|---|---|
| Capability registry | `src/capabilities/registry.ts` · `npm run capabilities:check` |
| Discovery HTTP | `GET /capabilities` (+ postly / skool) |
| Stub maps + logos | Luma, GitHub, Typefully, Postiz, ONCE |
| Repo rename | `notion-publisher` under Nucleo Lab |
| CMS contract docs | One DB `Publisher`, views by `Source Tags`, Social shared `Caption`/media + overrides |

---

## Backlog by phase

### Status labels (important)

| Label | Issue state | Meaning |
|---|---|---|
| `status:done` | **CLOSED** | Ya hecho / shipped (#12 Gumroad, #13 Postly, #14 Skool discover, #2 Caption) |
| `status:next` | OPEN | Siguiente — se puede empezar (**no** significa “completado”) |
| `status:blocked` | OPEN | Esperando a terceros (#4 MySkool write) |
| `status:later` | OPEN | Backlog después de Phase A |

`status:ready` was retired — too easy to read as Spanish “listo” = done.

### Phase A — CMS hygiene (next open work)

| Issue | Status | In plain words |
|---|---|---|
| [#1](https://github.com/Nucleo-Lab/notion-publisher/issues/1) Migrate live Notion DBs → one Publisher | next | Unify production DBs to the documented schema |
| [#3](https://github.com/Nucleo-Lab/notion-publisher/issues/3) Enable Notion MCP | next | Agents can inspect Publisher schema safely |

### Phase B — Products (after Phase A; Skool write last among these)

| Issue | Status | In plain words |
|---|---|---|
| [#5](https://github.com/Nucleo-Lab/notion-publisher/issues/5) GitHub Releases publish | later | Ship product files as Releases from Notion |
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
| [#9](https://github.com/Nucleo-Lab/notion-publisher/issues/9) Luma events client | later | Create/update events from Notion |
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
