# Progress + backlog

How to read this file: **what works today**, **what we already finished**, then **what’s left by phase**.  
Tracker: [GitHub Issues](https://github.com/Nucleo-Lab/notion-publisher/issues) on [`Nucleo-Lab/notion-publisher`](https://github.com/Nucleo-Lab/notion-publisher).

Do **not** invent publish webhooks for stub/discover connectors.

---

## What this repo does

**Notion is the CMS.** This service (`notion-publisher`) turns Notion rows + automations into publishes across layers:

Events → Products → Social → Music/Podcast.

---

## Live today

| Layer | Surface | Status | Meaning |
|---|---|---|---|
| CMS | Notion | live | Source of truth / automations |
| Products | Gumroad | **live** | Publish + unpublish webhooks |
| Social | Postly | **live** | Multi-platform webhooks |
| Products | Skool / MySkool | **discover** | Read API only (`GET /capabilities/skool`) |

Everything else in the kit is **mapped (stub)** — docs + registry, no publish client yet.

---

## Already done (kit + docs)

These are **finished**. They are not open issues.

| Done | Notes |
|---|---|
| Gumroad live pipeline | Autopilot, visuals, markdown→HTML descriptions |
| Postly live multi-platform | Per-platform caption overrides, queue/schedulers |
| Capability registry | `src/capabilities/registry.ts` · `npm run capabilities:check` |
| Discovery HTTP | `GET /capabilities`, `/capabilities/postly`, `/capabilities/skool` |
| Skool discover client | Read path; write waits on upstream (#4) |
| Stub maps + logos | Luma, GitHub, Typefully, Postiz, ONCE |
| Repo rename | `notion-publisher` under Nucleo Lab |
| CMS contract docs | One DB `Publisher`, views by `Source Tags`, Social shared `Caption`/media + channel overrides |

---

## Backlog by phase

Status labels on issues: `status:ready` · `status:blocked` · `status:later`.

### Phase A — CMS hygiene (next)

| Issue | Status | In plain words |
|---|---|---|
| [#1](https://github.com/Nucleo-Lab/notion-publisher/issues/1) Migrate live Notion DBs → one Publisher | ready | Unify production DBs to the documented schema |
| [#2](https://github.com/Nucleo-Lab/notion-publisher/issues/2) Accept `Caption` (+ `POV Text` fallback) | ready | Parser matches the docs name for shared caption |
| [#3](https://github.com/Nucleo-Lab/notion-publisher/issues/3) Enable Notion MCP | ready | Agents can inspect Publisher schema safely |

### Phase B — Products

| Issue | Status | In plain words |
|---|---|---|
| [#4](https://github.com/Nucleo-Lab/notion-publisher/issues/4) Skool write via MySkool | **blocked** | Needs upstream `POST` (or equivalent) before we code |
| [#5](https://github.com/Nucleo-Lab/notion-publisher/issues/5) GitHub Releases publish | later | Ship product files as Releases from Notion |

### Phase C — Social (clients + Postly opts)

| Issue | Status | In plain words |
|---|---|---|
| [#6](https://github.com/Nucleo-Lab/notion-publisher/issues/6) Typefully client | later | Text drafts/threads from shared Caption model |
| [#7](https://github.com/Nucleo-Lab/notion-publisher/issues/7) Postiz client (self-hosted preferred) | later | Widest scheduler surface |
| [#10](https://github.com/Nucleo-Lab/notion-publisher/issues/10) Postly `audience_group` opt-in | later | Flag off by default; no break to current publish |
| [#11](https://github.com/Nucleo-Lab/notion-publisher/issues/11) Expand `POSTLY_TARGET_PLATFORMS` | later | Only when accounts are ready |

### Phase D — Events / Music

| Issue | Status | In plain words |
|---|---|---|
| [#9](https://github.com/Nucleo-Lab/notion-publisher/issues/9) Luma events client | later | Create/update events from Notion |
| [#8](https://github.com/Nucleo-Lab/notion-publisher/issues/8) ONCE.app DSP client | later | Audio distribution to major DSPs |

---

## How to update this file

1. When an issue **ships**, close it on GitHub and move its row into **Already done**.
2. When MySkool write lands, flip #4 from `status:blocked` → `status:ready` (and update this table).
3. Keep README / CAPABILITIES roadmaps as a **short summary**; this file stays the SSOT.

---

## Related docs

- [README.md](../README.md) — architecture, Notion schema, per-source contracts  
- [CAPABILITIES.md](../CAPABILITIES.md) — status + channel matrices  
