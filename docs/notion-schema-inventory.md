# Notion schema inventory (live)

Generated via Notion API (`NOTION_TOKEN`). No secrets. IDs shown as suffix only.

## Env mapping (pre-unify)

| Env var | Role (runtime) | DB title | ID suffix | Props |
|--------|----------------|----------|-----------|-------|
| `NOTION_DATABASE_ID` | Default / Gumroad product source | GPT Chain Prompt Chain Templates | `…4f18feb6` | 24 |
| `GUMROAD_AUTOPILOT_DATABASE_ID` | Same as above (identical ID) | GPT Chain Prompt Chain Templates | `…4f18feb6` | 24 |
| `POSTLY_QUEUE_DATABASE_ID` | Postly / AI POVs queue | AI POVs Database | `…a56761b2` | 55 |

**Row counts (query):** Prompt Chain Templates ≈ **163**; AI POVs ≈ **62**.

## Survivor decision

Prefer **rename + extend AI POVs** → display name **Publisher** (social automations / Postly queue already on this DB). Merge Gumroad-only properties + rows into it. Old Prompt Chain Templates DB stays as **archive** (not deleted).

Title property on survivor today: `Rank` (rename → `Name` via API).

## Properties — AI POVs (survivor)

| Property | Type |
|----------|------|
| Rank | title |
| Status | status |
| Brand | select |
| Date | date |
| Created | created_time |
| Select / Select 1 | select |
| POV Text / (ES)/(PT) POV Text | rich_text |
| Instagram / TikTok / YouTube / Facebook / LinkedIn / Twitter / Reddit / Pinterest captions & titles | rich_text |
| Universal First Comment (+ ES/PT) | rich_text |
| Video / GIF / Screenshot / SongName | files |
| RemotionTemplate | rich_text |
| Instagram Status | status |
| Instagram URL / url | url |
| Post ID | rich_text |
| Publish Automation Groups | select |
| Generate / Publish Instagram / Publish Ignacio / Aaron / Saul / TheVeller / Nebualabs | button |

## Properties — Prompt Chain Templates (archive / migrate-from)

| Property | Type |
|----------|------|
| Prompt Chain Template Name | title |
| Status | status |
| Description / Text / Author / Template / Landing Page Copy / Gumroad Title / Gumroad Product ID | rich_text |
| Cover / Icon / Gumroad Cover / Gumroad Thumbnail | files |
| Folder | relation |
| Folder Tag / Audience | multi_select |
| Favorite | checkbox |
| Gumroad Publish Status | status (`Not started`, `Unpublished`, `Failed`, `Published`) |
| Gumroad URL / Gumroad Edit URL / url | url |
| Created time | created_time |
| Publish in Gumroad / Publish in Social | button |

## Gap matrix vs README Publisher contract

| Contract field | Survivor | Action |
|----------------|----------|--------|
| Name | `Rank` | Rename → `Name` |
| Source Tags | missing | Add multi_select (Postly, Gumroad, Luma, ONCE, …) |
| Layer | missing | Add select (Social / Products / Events / Music) |
| Topics | missing | Add multi_select |
| Status | present | Keep (social-oriented options) |
| Caption | missing | Add rich_text (code prefers over POV Text) |
| Video / GIF | present | Keep |
| Image / Audio / File | missing | Add files |
| Template | `RemotionTemplate` only | Add `Template` (product JSON); keep RemotionTemplate |
| Social caption overrides + Instagram Status/URL / Post ID | present | Keep |
| Gumroad Title / Cover / Thumbnail / Landing Page Copy | missing | Add from Gumroad DB |
| Gumroad Publish Status / Product ID / URL / Edit URL | missing | Add |
| Publish Postly | existing brand buttons | Keep; document webhook targets |
| Publish in Gumroad / Publish in Social | missing on survivor | UI/automation recreate (API button create may be limited) |

## Views (UI — not creatable via classic API)

Minimum set after unify:

- Category: Social — All · Products — All · Events — Luma · Music — ONCE  
- Source: Social — Postly · Products — Gumroad · (stubs later)  
- Master: All  

Filters: `Layer` and/or `Source Tags`.

## Buttons / automations (verify after cutover)

| Button (name) | Expected webhook |
|---------------|------------------|
| Publish Instagram / Publish *brand* | `/webhooks/publish-postly` (existing) |
| Publish in Gumroad | existing Gumroad publish webhook |
| Publish in Social | `/webhooks/publish-postly` |

Exact ngrok/base URL stays in Notion automation config (not in repo secrets).

## Post-unify status (2026-08-13)

| Item | Result |
|------|--------|
| Survivor | Renamed **Publisher** (was AI POVs); title prop `Rank` → `Name` |
| Schema | Added Source Tags, Layer, Topics, Caption, Image/Audio/File, Template, full Gumroad I/O props + `Migration Source Page ID` |
| Buttons via API | **Not supported** — recreate `Publish in Gumroad` / `Publish in Social` in Notion UI; keep existing brand Publish buttons |
| Views | UI checklist only (category + source axes) — see README |
| Tagged Postly rows | 62 (`Source Tags`=Postly, `Layer`=Social; Caption dual-filled from POV Text) |
| Migrated Gumroad rows | 163 (`Source Tags`=Gumroad, `Layer`=Products) |
| Unified total | 225 pages on Publisher |
| Env cutover | `NOTION_DATABASE_ID` = `GUMROAD_AUTOPILOT_DATABASE_ID` = `POSTLY_QUEUE_DATABASE_ID` → Publisher |
| Archive | Prompt Chain Templates (`…4f18feb6`) left read-only; not deleted |
| Writeback check | PATCH `Gumroad Edit URL` on a Gumroad-tagged page → OK |
