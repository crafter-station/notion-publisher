# Notion AI prompt — Publisher UI finish

API already created properties + migrated rows. Notion API **cannot** create views, reorder the table UI, or create Button automations. Paste the prompt below into **Notion AI on the `Publisher` database**.

**Open DB first:** https://app.notion.com/p/23bda2435b468091a195cd52a56761b2

**Copy webhook URLs from archive DB (do not invent):**  
https://app.notion.com/p/238da2435b468162a4aef7d64f18feb6 → open any page → edit automation on `Publish in Gumroad` / `Publish in Social` → reuse the same paths; only replace ngrok host if needed:

- `…/webhooks/publish-gumroad`
- `…/webhooks/unpublish-gumroad` (if present)
- `…/webhooks/publish-postly` (same as existing `Publish Instagram` on Publisher)

---

## Prompt (copy everything between the lines)

---

You are configuring the Notion database named **Publisher** (this database). Do not create a new database. Do not delete properties. Do not delete pages.

### Context (already done via API — do not recreate)

Properties that **already exist** (use them; do not duplicate):

**Control:** `Name` (title), `Source Tags` (multi-select), `Layer` (select: Social / Products / Events / Music), `Topics`, `Status`, `Brand`, `Date`, `Created`

**Shared media/copy:** `Caption`, `POV Text`, `Video`, `Image`, `GIF`, `Audio`, `File`, `Screenshot`, `SongName`, `Template`, `RemotionTemplate`

**Social EN overrides:** `Instagram Caption`, `TikTok Caption`, `YouTube Caption`, `YouTube Title`, `Facebook Post`, `LinkedIn Post`, `Twitter Post`, `Reddit Title`, `Reddit Body`, `Pinterest Title`, `Pinterest Description`, `Universal First Comment`

**Social ES/PT:** all `(ES) …` and `(PT) …` caption fields already present — keep, group as secondary

**Social outputs:** `Postly Publish Status`, `Postly URL`, `Post ID`, `Status` (aggregate; `Error`)

**Product (Gumroad):** `Gumroad Title`, `Gumroad Cover`, `Gumroad Thumbnail`, `Landing Page Copy`, `Gumroad Publish Status`, `Gumroad Product ID`, `Gumroad URL`, `Gumroad Edit URL`, `Migration Source Page ID`

**Existing buttons (keep):** `Publish Instagram`, `Publish Ignacio`, `Publish Aaron`, `Publish Saul`, `Publish TheVeller`, `Publish Nebualabs`, `Generate`, `Publish Automation Groups`, `Select`, `Select 1`

Rows are already tagged: `Source Tags`=Postly + `Layer`=Social (social rows); `Source Tags`=Gumroad + `Layer`=Products (product rows).

### Task 1 — Property layout (table + form)

In the **default table view** and page property layout:

1. Pin / show first (leftmost / top):  
   `Name`, `Layer`, `Source Tags`, `Status`, `Caption`, `Video`, `Image`, `GIF`
2. Next group — Social publish:  
   `Instagram Caption`, `TikTok Caption`, `YouTube Caption`, `Publish Instagram`, other `Publish *` brand buttons, `Instagram Status`, `Instagram URL`, `Post ID`
3. Next group — Products:  
   `Gumroad Title`, `Landing Page Copy`, `Template`, `Gumroad Cover`, `Gumroad Thumbnail`, `Gumroad Publish Status`, `Gumroad Product ID`, `Gumroad URL`, `Gumroad Edit URL`, and **new** buttons from Task 3
4. Hide by default (still keep in DB):  
   all `(ES)` / `(PT)` fields, `Migration Source Page ID`, `RemotionTemplate`, `Select`, `Select 1`, `SongName`, low-use fields
5. Keep `POV Text` visible but after `Caption` (legacy alias).

### Task 2 — Create these views (exact names)

Create database views with filters (table layout unless noted):

**Category / Layer**
1. `Social — All` → `Layer` equals `Social`
2. `Products — All` → `Layer` equals `Products`
3. `Events — All` → `Layer` equals `Events` OR `Source Tags` contains `Luma` OR (`Source Tags` contains `Composio` AND `Channels` contains `Eventbrite`)
4. `Events — Luma` → `Source Tags` contains `Luma`
5. `Music — ONCE` → `Layer` equals `Music` OR `Source Tags` contains `ONCE`

**Source**
6. `All` → no filter (master)
7. `Social — Postly` → `Source Tags` contains `Postly`
8. `Social — Composio / Typefully` → `Source Tags` contains `Composio` OR `Source Tags` contains `Typefully`
9. `Products — Gumroad` → `Source Tags` contains `Gumroad`
10. `Products — GitHub` → `Source Tags` contains `GitHub`

`Source Tags` includes **Composio**. `Channels` includes **Eventbrite** (and **Reddit**). Composio Eventbrite rows: tag Composio + Channel Eventbrite + Layer Events. Reddit: Composio + Channel Reddit + Layer Social.

For each view, show only relevant columns:
- Social views: Name, Layer, Source Tags, Channels, Status, Caption, Video, Image, GIF, Instagram Caption, Publish Instagram, Postly Publish Status, Postly URL
- Products views: Name, Layer, Source Tags, Gumroad Title, Gumroad Publish Status, Gumroad URL, Landing Page Copy, Template, Gumroad Cover, Publish in Gumroad
- Events views: Name, Layer, Source Tags, Channels, Luma Title, Luma Start, Luma Publish Status, Luma Event URL

### Task 3 — Buttons + automations

Create Button properties if missing:

1. **`Publish in Gumroad`**  
   Automation: on click → Send webhook POST to the **same URL** as the button with the same name on database **GPT Chain Prompt Chain Templates** (archive). Path must end with `/webhooks/publish-gumroad`. If that URL is dead, use current ngrok base + `/webhooks/publish-gumroad`. Copy headers/body from the archive automation.

2. **`Publish in Social`**  
   Same pattern as existing **`Publish Instagram`** on this Publisher DB (webhook path `/webhooks/publish-postly`).

Do **not** remove or rewrite the existing brand Publish buttons.

### Task 4 — Sanity check

After changes, confirm and report:
- View count and names created
- Whether `Publish in Gumroad` / `Publish in Social` exist and which webhook URL each uses
- That no duplicate properties were created (especially Caption, Source Tags, Layer, Gumroad *)
- Sample: one Products—Gumroad row shows Gumroad URL; one Social—Postly row shows Caption

If you cannot read the archive automation URL, ask me for the current ngrok HTTPS base and pause button wiring only.

---

## After Notion AI finishes (you)

1. Restart local publisher: `npm run build && npm run dev`
2. `ngrok http 3000` — if host changed, update button webhook URLs
3. Smoke: one Gumroad button + one Postly button
4. Leave archive DB; delete later
