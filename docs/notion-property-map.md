# Notion ↔ code property map (Publisher)

Live DB: **Publisher** (`…a56761b2`).  
Archive (do not point env here): GPT Chain Prompt Chain Templates (`…4f18feb6`).

## Notion API version

| Choice | Why |
|--------|-----|
| **`2022-06-28`** (code default via `NOTION_VERSION`) | Database retrieve/query/property PATCH works end-to-end |
| `2025-09-03` | Returns `data_sources[]`; property schema moves to `GET/PATCH /v1/data_sources/{id}`. Query path not wired in this repo yet — do not bump globally until helpers exist |

Constant: `src/services/notion.service.ts` → `export const NOTION_VERSION`.

## Env (must all match Publisher)

| Var | Must be |
|-----|---------|
| `NOTION_DATABASE_ID` | Publisher |
| `POSTLY_QUEUE_DATABASE_ID` | Publisher |
| `GUMROAD_AUTOPILOT_DATABASE_ID` | Publisher |

**Gotcha:** if the shell already exported the old archive ID, `dotenv` will **not** override it. Restart the terminal / `unset NOTION_DATABASE_ID` before `npm run dev`.

## Per-source writeback pattern

| Source | Status prop | URL prop | Notes |
|--------|-------------|----------|-------|
| **Gumroad** (live) | `Gumroad Publish Status` | `Gumroad URL` (+ Edit URL, Product ID) | |
| **Postly** (live) | `Postly Publish Status` | `Postly URL` | + aggregate `Status`; `Post ID` multi-line |
| **Luma** (live) | `Luma Publish Status` | `Luma Event URL` | `POST /webhooks/publish-luma`; cover CDN upload |
| **GitHub** (live) | `GitHub Publish Status` | `GitHub Release URL` (+ ID) | TheVeller Releases only; catalog import |
| **Skool** (discover) | `Skool Publish Status` | `Skool Post URL` | props exist; **no** publish webhook until MySkool `POST /v1/posts` (#4) |
| Typefully / Postiz / ONCE | `* Publish Status` (props present) | `* URL` where present | stubs — no code write yet |

Aggregate row `Status` uses evergreen **`Error`** (was `Postly Error`; 41 rows migrated).

## Product (Gumroad) — `parseNotionPage` / writebacks

| Notion property | Code | Notes |
|-----------------|------|-------|
| `Gumroad Title` | title (preferred) | |
| `Name` | title fallback | was `Prompt Chain Template Name` on archive |
| `Landing Page Copy` | description HTML | |
| `Template` | `chain_json` | |
| `Gumroad Cover` | `cover_url` | |
| `Gumroad Thumbnail` | `thumbnail_url` | |
| `Cover` / `Icon` | optional | **not on Publisher**; code falls back to Gumroad Cover/Thumbnail |
| `Gumroad Product ID` | read + writeback | |
| `Gumroad URL` / `Gumroad Edit URL` | read + writeback | |
| `Gumroad Publish Status` | writeback | Not started / Unpublished / Failed / Published |

Autopilot query filters: `Source Tags`∋Gumroad **or** `Layer`=Products + completeness gates. Sort: `Created`.

## Social (Postly) — `extractPostlyContent` / writebacks

| Notion property | Code | Notes |
|-----------------|------|-------|
| `Caption` → `POV Text` → platform captions | `global_text` | prefer Caption |
| Platform caption fields | overrides | Instagram Caption / TikTok / YouTube / `Twitter Post` (not `X Post`) |
| `Video` → `GIF` → `Image` → `Screenshot` | `media_url` | |
| `Brand`, `Select`, `url` | queue gates | lowercase `url` = source link, not publish URL |
| `Postly Publish Status` | pipeline phase | was `Instagram Status` |
| `Postly URL` | first published URL | was `Instagram URL` (IG preferred, else any) |
| `Post ID` | multi-line platform log | |
| `Status` | aggregate | `Published (EN)` / `Error` / … |

Queue filters: `Source Tags`∋Postly **or** `Layer`=Social + `Status`/`Postly Publish Status` = Not started.

## Events (Luma) — `extractLumaContent` / writebacks

| Notion property | Code | Notes |
|-----------------|------|-------|
| `Luma Title` → `Luma Name` → `Name` | `name` | required |
| `Luma Start` | `start_at` | required (date) |
| `Luma End` | `end_at` | optional |
| `Luma Location` | manual `geo_address_json` or `meeting_url` if http(s) | |
| `Luma Description` | `description_md` | |
| `Luma Cover` | uploaded to Luma CDN on publish | jpeg/png via create-upload-url |
| `Luma Publish Status` | writeback | Not started / In progress / Published / Failed |
| `Luma Event URL` | writeback | from `GET /v1/events/get` after create; also set on import mirror |
| timezone | `GUMROAD_AUTOPILOT_TIMEZONE` (default `America/Lima`) | no Notion prop yet |

Import: `npm run luma:import-tnc` (five Aug-29 The Next Craft → Publisher, idempotent).

Ngrok: `npm run dev` → `ngrok http <port>` → Notion button → `POST /webhooks/publish-luma`.

## Products (GitHub) — `extractGithubPublishContent` / writebacks

| Notion property | Code | Notes |
|-----------------|------|-------|
| `GitHub Repo` | `owner`/`repo` | `owner/repo` or URL; publish requires `TheVeller/…` |
| `GitHub Org` | catalog select | `TheVeller` \| `Nucleo-Lab` \| `crafter-station` \| `GPT-Chain` |
| `Release Tag` | `tag` | else auto `vYYYY.MM.DD-<slug>` |
| `Release Notes` | `release_notes` | real notes only; smoke stubs ignored |
| `Landing Page Copy` | `landing_page_md` | README body + default release body |
| `Template` / `File` / `GitHub Asset` | asset | seeds `template.json` + release asset |
| `Gumroad Cover` / `Thumbnail` | `cover_url` / `thumbnail_url` | cover → `docs/cover.*` |
| `Gumroad URL` | homepage + Buy | repo `homepage` + README / release link |
| `GitHub Publish Status` | writeback | Not started / Mapped / In progress / Failed / Published |
| `GitHub Release URL` / `GitHub Release ID` | writeback | |

Publish also seeds repo meta (description, topics `gpt-chain`/`gumroad`/`prompt-chain`) before creating the Release.

Catalog import: `npm run github:import-repos -- --owner=TheVeller` (idempotent; status → `Mapped`).

Ngrok: button → `POST /webhooks/publish-github` (optional `?draft=true`).

## Skool (discover only)

| Notion property | Notes |
|-----------------|-------|
| `Skool Title` / `Body` / `Group ID` | props ready; no invent publish |
| `Skool Publish Status` / `Post URL` | UI-only until MySkool write ships |
| Button `Publish in Skool` | **do not** wire webhook that pretends success |

Discover: `GET /capabilities/skool` · needs valid `SKOOL_API_KEY=sk_live_…`. Leave `SKOOL_GROUP_ID` empty until groups list succeeds.

## Buttons (Notion UI → webhooks)

| Button | Path |
|--------|------|
| `Publish in Gumroad` | `/webhooks/publish-gumroad` |
| `Publish in Social` / `Publish Instagram` / brand Publish * | `/webhooks/publish-postly` |
| `Publish in Luma` (when added) | `/webhooks/publish-luma` |
| `Publish in GitHub` (when added) | `/webhooks/publish-github` |
| `Publish in Skool` | **not wired** — MySkool POST still Planned (#4) |

Automations are **not** readable via API. After ngrok restart, open each button → Edit automation → confirm host.

## Present in Notion, **not** used by code yet

| Property | Action |
|----------|--------|
| `Channels` | Notion UI only (wire later) |
| `X Post` | unused; code reads `Twitter Post` |
| `Postly Error` (rich_text) | unused leftover; aggregate errors use `Status`=`Error` |
| Stub `* Publish Status` / URLs (Typefully / Postiz / ONCE) | props-only until clients ship |
| Skool write props / button | blocked on MySkool `#4` |
| `(ES)` / `(PT)` captions | EN path only |
| `Migration Source Page ID` | audit |

## Verify after restart

```bash
unset NOTION_DATABASE_ID GUMROAD_AUTOPILOT_DATABASE_ID POSTLY_QUEUE_DATABASE_ID
set -a && source .env && set +a
npm run build && npm run dev
# ngrok http 3000
```

Then one Gumroad button + one Postly button on Publisher rows. Confirm writebacks land on `Gumroad *` / `Postly Publish Status` / `Postly URL` / `Status`.
