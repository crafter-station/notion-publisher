import { GET as verifySet } from '../sets/[id]/verify/route';
import { GET as listSets, POST as createSet } from '../sets/route';
import { GET as getSet, PATCH as updateSet } from '../sets/[id]/route';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { ApiError, context, handle } from '../../../../lib/server/context';
import { readInput } from '../../../../lib/server/drafts';
import { GET as session } from '../session/route';
import { GET as notionInventory } from '../notion/route';
import { POST as notionImport } from '../notion/import/route';
import {
  GET as notionCompare,
  POST as notionPull,
  PUT as notionPush,
  PATCH as notionReconcile,
} from '../drafts/[id]/notion/route';
import {
  GET as typefullyStatus,
  POST as typefullyCreate,
} from '../drafts/[id]/typefully/route';
import { GET as channels } from '../channels/route';
import { GET as connections } from '../connections/route';
import { GET as listDrafts, POST as createDraft } from '../drafts/route';
import { GET as getDraft, PATCH as updateDraft } from '../drafts/[id]/route';
import { POST as reviewDraft } from '../drafts/[id]/review/route';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return handle(async () => {
    await context(request);
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin)
      throw new ApiError(403, 'origin_rejected', 'Origen no permitido.');
    const parsedBody = await readInput(request);
    const server = new McpServer({ name: 'open-publisher', version: '0.4.0' });
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
    });
    // Reuse the API handlers: authorization, optimistic concurrency and validation
    // remain identical across browser, CLI and MCP. No internal network hop.
    function apiRequest(path: string, method = 'GET', body?: unknown) {
      const headers = new Headers(request.headers);
      headers.delete('content-length');
      headers.set('content-type', 'application/json');
      return new Request(new URL('/api/v1/' + path, request.url), {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    }
    async function result(response: Promise<Response>) {
      const resolved = await response;
      const body = (await resolved.json()) as Record<string, unknown>;
      return {
        ...(resolved.ok ? { structuredContent: body } : { isError: true }),
        content: [{ type: 'text' as const, text: JSON.stringify(body) }],
      };
    }
    const read = {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    };
    const write = {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    };
    const content = {
      title: z.string().max(200),
      body: z.string().max(100000),
      publicationSet: z.object({ id: z.uuid(), revision: z.number().int().positive() }).nullable().optional().describe('Pin the account snapshot of a native publication set revision; null clears it, omission preserves it. Does not publish.'),
      mediaIds: z
        .array(z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/))
        .max(100)
        .optional()
        .describe(
          'Ordered IDs of completed private uploads belonging to this draft. Omit to preserve attachments; [] removes them. Create the draft before uploading; changes invalidate approval.',
        ),
      channelSettings: z
        .record(z.string(), z.string())
        .optional()
        .describe(
          'Channel-specific fields: reddit_title, reddit_subreddit, reddit_kind (self/link), reddit_link and reddit_flair. Omission preserves existing settings on updates.',
        ),
      versions: z.record(
        z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
        z.string().max(100000),
      ),
    };
    const identity = { id: z.string().min(1).max(100) };
    const revision = z.number().int().positive();
    const params = (id: string) => ({ params: Promise.resolve({ id }) });
    const setAccounts = z
      .array(
        z.object({
          provider: z.string().regex(/^[a-z0-9_-]{1,80}$/),
          accountId: z.string().min(1).max(512),
          sourceGroupId: z.string().min(1).max(512).optional(),
        }),
      )
      .max(200);
    const setContent = {
      name: z.string().min(1).max(120),
      accounts: setAccounts,
    };
    server.registerTool(
      'publisher_list_sets',
      {
        description:
          'List native publication sets in this workspace. Follow nextCursor using after. References do not grant permissions or prove connected accounts.',
        inputSchema: { after: z.uuid().optional() },
        annotations: read,
      },
      ({ after }) =>
        result(
          listSets(
            apiRequest(
              'sets' + (after ? '?after=' + encodeURIComponent(after) : ''),
            ),
          ),
        ),
    );
    server.registerTool(
      'publisher_get_set',
      {
        description:
          'Read a native publication set and its revision. Account references still require provider verification before delivery.',
        inputSchema: { id: z.uuid() },
        annotations: read,
      },
      ({ id }) => result(getSet(apiRequest('sets/' + id), params(id))),
    );
    server.registerTool(
      'publisher_verify_set',
      {
        description: 'Read current provider inventories to verify this set’s account references and group membership. Reports disconnected, missing, hidden and unavailable accounts. This snapshot does not authorize publishing.',
        inputSchema: { id: z.uuid() },
        annotations: read,
      },
      ({ id }) => result(verifySet(apiRequest('sets/' + id + '/verify'), params(id))),
    );
    server.registerTool(
      'publisher_create_set',
      {
        description:
          'Create a workspace-visible native publication set. Generate and retain a lowercase UUID before calling; repeat that ID with identical content to recover a lost response. Does not create remote social sets, attach drafts or authorize publication.',
        inputSchema: { id: z.uuid(), ...setContent },
        annotations: { ...write, idempotentHint: true },
      },
      (input) => result(createSet(apiRequest('sets', 'POST', input))),
    );
    server.registerTool(
      'publisher_update_set',
      {
        description:
          'Replace a native set name and ordered account references using its current revision. Conflicts require rereading. Does not change draft destinations or provider permissions.',
        inputSchema: { id: z.uuid(), revision, ...setContent },
        annotations: write,
      },
      ({ id, ...input }) =>
        result(updateSet(apiRequest('sets/' + id, 'PATCH', input), params(id))),
    );
    server.registerTool(
      'publisher_session',
      {
        description: 'Read your workspace and current role.',
        inputSchema: {},
        annotations: read,
      },
      () => result(session(apiRequest('session'))),
    );
    server.registerTool(
      'publisher_list_connections',
      {
        description:
          'Read connected provider accounts and groups. Read verification does not prove publishing permissions.',
        inputSchema: {},
        annotations: { ...read, openWorldHint: true },
      },
      () => result(connections(apiRequest('connections'))),
    );
    server.registerTool(
      'publisher_list_channels',
      {
        description:
          'List all mapped destination channels, categories and provider routes. Coverage is not proof of a connected account or publishing readiness.',
        inputSchema: {},
        annotations: read,
      },
      () => result(channels(apiRequest('channels'))),
    );
    server.registerTool(
      'publisher_list_notion',
      {
        description:
          'Read the Notion CMS inventory. Use nextCursor to paginate.',
        inputSchema: { cursor: z.string().max(4096).optional() },
        annotations: { ...read, openWorldHint: true },
      },
      ({ cursor }) =>
        result(
          notionInventory(
            apiRequest(
              'notion' +
                (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''),
            ),
          ),
        ),
    );
    server.registerTool(
      'publisher_import_notion',
      {
        description:
          'Open a Notion record as a linked native draft. Repeated imports preserve local edits. Does not write to Notion or publish.',
        inputSchema: { pageId: z.string().min(32).max(36) },
        annotations: { ...write, idempotentHint: true, openWorldHint: true },
      },
      ({ pageId }) =>
        result(notionImport(apiRequest('notion/import', 'POST', { pageId }))),
    );
    server.registerTool(
      'publisher_compare_notion',
      {
        description:
          'Compare original, local and current Notion text by field. Returns conflicts, an outbound field plan, remoteEditedAt and recent write attempts. Read before pulling or pushing.',
        inputSchema: identity,
        annotations: { ...read, openWorldHint: true },
      },
      ({ id }) =>
        result(
          notionCompare(
            apiRequest('drafts/' + encodeURIComponent(id) + '/notion'),
            params(id),
          ),
        ),
    );
    server.registerTool(
      'publisher_pull_notion',
      {
        description:
          'Incorporate current Notion text while preserving disjoint local changes. Requires explicit local/notion choices and the compared remoteEditedAt for conflicts; rejects stale revisions or changed Notion content. Does not write to Notion or publish. Content changes reset approval.',
        inputSchema: {
          ...identity,
          revision,
          resolutions: z
            .record(z.string(), z.enum(['local', 'notion']))
            .optional(),
          remoteEditedAt: z.string().optional(),
        },
        annotations: { ...write, openWorldHint: true },
      },
      ({ id, revision, resolutions, remoteEditedAt }) =>
        result(
          notionPull(
            apiRequest('drafts/' + encodeURIComponent(id) + '/notion', 'POST', {
              revision,
              resolutions,
              remoteEditedAt,
            }),
            params(id),
          ),
        ),
    );
    server.registerTool(
      'publisher_push_notion',
      {
        description:
          'Write saved draft text to its linked Notion CMS record. First compare; incorporate or resolve remote changes before pushing. Requires the saved draft revision and remoteEditedAt from comparison. Updates only mapped text fields, converting edited rich text to plain text. A durable attempt journal blocks retries after uncertain results; compare again and seek reconciliation instead. Does not set publication controls or schedule social posts. Direct concurrent edits in Notion cannot be locked by this API.',
        inputSchema: {
          ...identity,
          revision,
          remoteEditedAt: z.string().min(1).max(100),
        },
        annotations: { ...write, destructiveHint: true, openWorldHint: true },
      },
      ({ id, revision, remoteEditedAt }) =>
        result(
          notionPush(
            apiRequest('drafts/' + encodeURIComponent(id) + '/notion', 'PUT', {
              revision,
              remoteEditedAt,
            }),
            params(id),
          ),
        ),
    );
    server.registerTool(
      'publisher_reconcile_notion',
      {
        description:
          'Administrator only: close a specific uncertain Notion write after at least two minutes. Compare first and use its current remoteEditedAt and attempt id. confirm requires Notion to contain the attempted text; keep_notion acknowledges the current remote content and cancels the old attempt without resending. Neither action changes Notion or the local draft. Compare again before any later push. Never use keep_notion as an automatic retry mechanism.',
        inputSchema: {
          ...identity,
          attemptId: z.uuid(),
          remoteEditedAt: z.string().min(1).max(100),
          action: z.enum(['confirm', 'keep_notion']),
        },
        annotations: { ...write, openWorldHint: true },
      },
      ({ id, ...input }) =>
        result(
          notionReconcile(
            apiRequest(
              'drafts/' + encodeURIComponent(id) + '/notion',
              'PATCH',
              input,
            ),
            params(id),
          ),
        ),
    );
    server.registerTool(
      'publisher_list_drafts',
      {
        description:
          'List the most recent 100 team drafts, optionally filtered by review status.',
        inputSchema: {
          status: z.enum(['draft', 'in_review', 'approved']).optional(),
        },
        annotations: read,
      },
      ({ status }) =>
        result(
          listDrafts(
            apiRequest('drafts' + (status ? '?status=' + status : '')),
          ),
        ),
    );
    server.registerTool(
      'publisher_get_draft',
      {
        description: 'Read a draft and its revision before editing.',
        inputSchema: identity,
        annotations: read,
      },
      ({ id }) =>
        result(
          getDraft(apiRequest('drafts/' + encodeURIComponent(id)), params(id)),
        ),
    );
    server.registerTool(
      'publisher_create_draft',
      {
        description:
          'Create an unpublished draft. Does not publish or schedule.',
        inputSchema: content,
        annotations: write,
      },
      (input) => result(createDraft(apiRequest('drafts', 'POST', input))),
    );
    server.registerTool(
      'publisher_update_draft',
      {
        description:
          'Update using the current revision. On conflict read again and reconcile changes; never blindly retry. Editing resets approval.',
        inputSchema: { ...identity, revision, ...content },
        annotations: write,
      },
      ({ id, ...input }) =>
        result(
          updateDraft(
            apiRequest('drafts/' + encodeURIComponent(id), 'PATCH', input),
            params(id),
          ),
        ),
    );
    server.registerTool(
      'publisher_review_draft',
      {
        description:
          'Submit, approve or return a draft. Approval requires an approver or administrator. Does not publish.',
        inputSchema: {
          ...identity,
          revision,
          action: z.enum(['submit', 'approve', 'return']),
        },
        annotations: write,
      },
      ({ id, ...input }) =>
        result(
          reviewDraft(
            apiRequest(
              'drafts/' + encodeURIComponent(id) + '/review',
              'POST',
              input,
            ),
            params(id),
          ),
        ),
    );
    server.registerTool(
      'publisher_typefully_status',
      {
        description:
          'Read private Typefully draft receipts and uncertain creation attempts for a native draft.',
        inputSchema: identity,
        annotations: read,
      },
      ({ id }) =>
        result(
          typefullyStatus(
            apiRequest('drafts/' + encodeURIComponent(id) + '/typefully'),
            params(id),
          ),
        ),
    );
    server.registerTool(
      'publisher_create_typefully_draft',
      {
        description:
          'Create one private, unscheduled text draft in a verified Typefully social set through Composio. Rejects empty posts, unconnected channels, linked Notion media and stale revisions. A durable claim prevents duplicate creation; uncertain attempts require reconciliation. Later native edits do not update the existing Typefully copy. Does not publish.',
        inputSchema: {
          ...identity,
          revision,
          socialSetId: z.number().int().positive(),
          channels: z
            .array(z.enum(['X', 'LinkedIn', 'Threads', 'Bluesky', 'Mastodon']))
            .min(1)
            .max(5),
        },
        annotations: { ...write, openWorldHint: true, idempotentHint: true },
      },
      ({ id, ...input }) =>
        result(
          typefullyCreate(
            apiRequest(
              'drafts/' + encodeURIComponent(id) + '/typefully',
              'POST',
              input,
            ),
            params(id),
          ),
        ),
    );
    await server.connect(transport);
    try {
      return await transport.handleRequest(request, { parsedBody });
    } finally {
      await server.close();
    }
  });
}
export function GET() {
  return new Response(null, { status: 405, headers: { Allow: 'POST' } });
}
export function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: 'POST' } });
}
