```
 ____        _     _ _     _
|  _ \ _   _| |__ | (_)___| |__   ___ _ __
| |_) | | | | '_ \| | / __| '_ \ / _ \ '__|
|  __/| |_| | |_) | | \__ \ | | |  __/ |
|_|    \__,_|_.__/|_|_|___/_| |_|\___|_|
  Capability Kit · Notion → Gumroad · Postly · more
```

**Portable publishing microservice.** Turn Notion (or any HTTP caller) into a CMS that ships products to Gumroad and social posts through Postly — with a capability registry for distributors you will plug in later (MySkool, Typefully, NCE, Postis).

> Hosted at [`Nucleo-Lab/gumroad-published`](https://github.com/Nucleo-Lab/gumroad-published) (private). Nebulabs / GPT Chain brands publish through the same kit.

## Why this exists

| Need | What you get |
|---|---|
| Sell digital products | Notion → Gumroad draft/live + autopilot |
| Multi-channel social | Notion → Postly (per-platform captions + polling) |
| Know what you *can* connect | Capability registry + discovery endpoints |
| Drop into other flows | Clone, set env, hit webhooks — no UI lock-in |

Full distributor map and Postly channel matrix: **[CAPABILITIES.md](./CAPABILITIES.md)**.

## Architecture

![Publisher capability flow](./docs/assets/publisher-capability-flow.png)

Source: [`docs/assets/publisher-capability-flow.excalidraw`](./docs/assets/publisher-capability-flow.excalidraw)

**Live today:** Gumroad · Postly  
**Mapped stubs:** MySkool · Typefully · NCE · Postis  
**Discover only (no publish side effects):** `GET /capabilities`, `GET /capabilities/postly`

## Quick start

```bash
npm install
cp .env.example .env   # fill NOTION_TOKEN, GUMROAD_TOKEN, POSTLY_*
npm run build
npm run dev            # http://localhost:3000
npm run capabilities:check
```

Expose for Notion (local):

```bash
ngrok http 3000
# then point automations at:
#   https://<ngrok>/webhooks/publish-gumroad
#   https://<ngrok>/webhooks/unpublish-gumroad
#   https://<ngrok>/webhooks/publish-postly
```

## Features

| Area | Capability |
|---|---|
| Gumroad | Create draft, upload file/cover, publish/unpublish, daily autopilot |
| Postly | Multi-target publish, per-platform overrides, queue scheduler, audience-group discovery |
| Safety | Incomplete Notion rows stay Gumroad drafts (`Unpublished`) |
| Discovery | Static registry + live Postly socials / audience groups |
| Extensibility | Stub entries for Skool, Typefully, music (NCE), Postis |

New Postly channels (Bluesky, Telegram, X, …) live in the **catalog**. Default `POSTLY_TARGET_PLATFORMS` is unchanged until you opt in.

## HTTP surface

| Method | Path | Role |
|---|---|---|
| `POST` | `/webhooks/publish-gumroad` | Create/publish product |
| `POST` | `/webhooks/unpublish-gumroad` | Unpublish product |
| `POST` | `/webhooks/publish-postly` | Social publish (`?target=0,2` optional) |
| `GET` | `/capabilities` | Registry + Postly platform catalog |
| `GET` | `/capabilities/postly` | Live socials + audience groups |

## Environment

Minimal (see [`.env.example`](./.env.example)):

```env
NOTION_TOKEN=
GUMROAD_TOKEN=
POSTLY_API_KEY=
POSTLY_WORKSPACE_ID=
POSTLY_TARGET_PLATFORMS=instagram:id,facebook:id
# Optional later: POSTLY_AUDIENCE_GROUP=  SKOOL_API_KEY=
```

## Notion contract (high level)

**Gumroad inputs:** `Gumroad Title`, `Landing Page Copy`, `Template` (JSON), cover/thumbnail files.  
**Gumroad outputs:** publish status, product id, public + edit URLs.

**Postly inputs:** per-platform captions + media (`Video` / image).  
**Postly outputs:** Instagram status/URL, Post IDs.

Property names are case-sensitive — keep the existing database schema.

## Scripts

```bash
npm run build
npm run dev
npm run capabilities:check
npm run publisher:report
```

## Contributing

Internal Nucleo Lab / Nebulabs tooling. Open an issue or PR on the private GitHub repo for schema or connector changes. Prefer tiny diffs; see [`CAPABILITIES.md`](./CAPABILITIES.md) before adding a distributor.

## License

Private repository. All rights reserved unless a `LICENSE` file is added later.
