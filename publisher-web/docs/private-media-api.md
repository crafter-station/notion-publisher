# Private media staging API

All routes require an existing Publisher session or API token. Mutations require
write access and the administrator/editor role; browser mutations also require
the matching Origin. A Sites credential alone does not replace Publisher auth.

- `POST /api/v1/media`: JSON `{draftId, idempotencyKey, fileName, size, declaredType}`.
  Reserve the key for exactly one file. Returns the upload ID, state and part size.
  Repeating identical metadata returns the same upload; different metadata conflicts.
- `GET /api/v1/media/{id}`: persisted progress and confirmed part numbers.
- `PUT /api/v1/media/{id}?part=1`: raw binary bytes, numbered from one.
  Each part is 10 MiB except the last. SHA-256 is computed on the server.
  Retransmitting identical bytes is safe; replacing a claimed part is rejected.
- `POST /api/v1/media/{id}`: finish after all parts are confirmed. Repeating after
  a lost completion response reconciles R2 and returns persisted readiness.

The current per-file limit is 5 GiB. Bound each request to one part; do not send
an entire large file in one request. Save the upload ID and idempotency key before
continuing. A `creating` session without a storage ID is uncertain: do not silently
start a second upload. Recovery of orphaned session creation is not yet exposed.

`ready` means bytes are stored in private R2, not that a platform accepts the
media. MIME is declared metadata, not verified decoding. There is currently no
public object route, provider transfer, native preview, or MCP upload tool.
Staging does not change the draft revision or approval. Attach completed uploads
using draft PATCH `mediaIds`, alongside title/body/versions and current revision.
Only uploads for that same draft are accepted; their order is preserved. Omit
`mediaIds` to preserve attachments, or send `[]` to detach without deleting bytes.
Attachment changes increment the draft revision and invalidate approval. MCP
draft updates expose the same field. The text-only Typefully adapter rejects
attached media instead of silently dropping it. Original files remain separate from Postly storage,
whose completion has different visibility semantics.

Validation: `node scripts/check-media-api.mjs` exercises the shared authentication
logic with SQLite and local R2. Production authentication and full editor flow
still require end-to-end acceptance.

## Terminal upload and recovery

Run `node scripts/open-publisher-media.mjs` with JSON on stdin:

```json
{"filePath":"/absolute/path/video.mp4","draftId":"YOUR_DRAFT_ID","declaredType":"video/mp4","journalPath":"/absolute/private/directory/upload.json"}
```

Uses the same `OPEN_PUBLISHER_URL`, `OPEN_PUBLISHER_TOKEN` and optional
`OPEN_PUBLISHER_SITES_TOKEN` as the normal CLI. The journal directory must exist.
The journal is created with mode 0600 before the first mutation and contains no
credentials. Keep it: re-run identical input after interruption to reconcile the
same session. The CLI hashes each part before starting and rejects a different
file, draft or workspace on resume. It reads one 10 MiB part at a time. Progress
is JSON on stderr; the final media record is JSON on stdout. Completion does not
attach or publish; attach the returned ID with a revision-checked draft update.

`GET /api/v1/channels` (also exposed through MCP channel discovery) now describes
these storage endpoints separately from unverified channel media delivery.
`node scripts/check-media-client.mjs` tests the CLI against a local HTTP fixture,
including lost creation, part and completion responses. It is not a production
upload or platform delivery test.
