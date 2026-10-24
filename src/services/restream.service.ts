import { env } from '../config/env';
import { ConnectorDryRunResult, isDryRun, PublishModeOptions } from '../connectors/dry-run';

export const RESTREAM_API_BASE = 'https://api.restream.io/v2';

export const RESTREAM_STREAM_TYPES = ['studio', 'encoder', 'file'] as const;
export type RestreamStreamType = (typeof RESTREAM_STREAM_TYPES)[number];

/** Exact POST /v2/user/events/new body (create / schedule only). */
export type RestreamCreateEventPayload = {
  streamType: RestreamStreamType;
  title?: string;
  description?: string;
  scheduledFor?: string;
  fileId?: string;
  loopsCount?: number;
};

export type RestreamCreateInput = {
  streamType?: string;
  title: string;
  description?: string;
  scheduledFor?: string;
  fileId?: string;
  loopsCount?: number;
};

export function isRestreamConfigured(): boolean {
  return !!env.RESTREAM_ACCESS_TOKEN;
}

export function normalizeRestreamStreamType(raw?: string): RestreamStreamType {
  const v = String(raw || 'encoder').trim().toLowerCase();
  if (v === 'studio' || v === 'encoder' || v === 'file') return v;
  throw new Error(`Restream streamType must be studio|encoder|file (got ${raw})`);
}

export function buildRestreamCreatePayload(input: RestreamCreateInput): {
  payload: RestreamCreateEventPayload;
  path: string;
  missing: string[];
} {
  const missing: string[] = [];
  if (!input.title?.trim()) missing.push('title');

  let streamType: RestreamStreamType = 'encoder';
  try {
    streamType = normalizeRestreamStreamType(input.streamType);
  } catch (err: any) {
    missing.push(err.message);
  }

  if (streamType === 'file' && !input.fileId?.trim()) {
    missing.push('fileId (required when streamType=file)');
  }

  if (input.scheduledFor) {
    const d = new Date(input.scheduledFor);
    if (Number.isNaN(d.getTime())) missing.push('scheduledFor (ISO 8601)');
  }

  const payload: RestreamCreateEventPayload = { streamType };
  if (input.title?.trim()) payload.title = input.title.trim();
  if (input.description?.trim()) payload.description = input.description.trim();
  if (input.scheduledFor) {
    const d = new Date(input.scheduledFor);
    if (!Number.isNaN(d.getTime())) payload.scheduledFor = d.toISOString();
  }
  if (streamType === 'file' && input.fileId) payload.fileId = input.fileId.trim();
  if (streamType === 'file' && input.loopsCount && input.loopsCount > 0) {
    // Looping is a paid Restream feature — never assume it.
    missing.push('loopsCount requires a paid Restream looping feature; omit it');
  }

  return { payload, path: '/user/events/new', missing };
}

export class RestreamService {
  private headers: Record<string, string>;
  private base: string;

  constructor(token: string = env.RESTREAM_ACCESS_TOKEN, base: string = RESTREAM_API_BASE) {
    this.headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    this.base = base.replace(/\/$/, '');
  }

  /**
   * Create or schedule a Restream event (not go-live).
   * Always dry-run: builds and validates POST /v2/user/events/new, never calls it.
   * StreamYard is out of scope.
   */
  async createEvent(
    input: RestreamCreateInput,
    options: PublishModeOptions = {}
  ): Promise<ConnectorDryRunResult<RestreamCreateEventPayload & { path: string }>> {
    if (!isDryRun(options)) {
      throw new Error(
        'Restream live create is disabled. Connector is create/schedule dry-run only (no go-live, no StreamYard).'
      );
    }

    const built = buildRestreamCreatePayload(input);
    if (built.missing.length) {
      throw new Error(`Incomplete Restream payload: ${built.missing.join('; ')}`);
    }

    return {
      dry_run: true,
      called_publish: false,
      payload: { ...built.payload, path: built.path },
    };
  }
}
