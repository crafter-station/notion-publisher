/**
 * Thin adapters for Gumroad / Postly / Luma / GitHub so they share
 * validate() / publish({dryRun}) / capabilities() with the newer clients.
 * Dry-run builds a payload and does not call the vendor API.
 */

import { env } from '../config/env';
import {
  extractGithubPublishContent,
  extractLumaContent,
  extractPostlyContent,
  parseNotionPage,
} from '../services/notion.service';
import { Connector, ConnectorCapabilities, ConnectorValidation } from './types';
import { ConnectorResult } from './dry-run';

export type LegacyPageInput = { properties: Record<string, any>; notionPageId?: string };

function dry<T>(payload: T): ConnectorResult<T> {
  return { dry_run: true, called_publish: false, payload };
}

export class PostlyConnector implements Connector<LegacyPageInput> {
  id = 'postly' as const;
  validate(input: LegacyPageInput): ConnectorValidation {
    const content = extractPostlyContent(input.properties || {});
    return { ok: content.is_complete, missing: content.missing };
  }
  async publish(input: LegacyPageInput, options: { dryRun: boolean }) {
    const content = extractPostlyContent(input.properties || {});
    if (!content.is_complete) throw new Error(`Incomplete Postly: ${content.missing.join('; ')}`);
    if (options.dryRun) return dry({ kind: 'postly', content });
    throw new Error('Postly live publish goes through POST /webhooks/publish-postly (alias)');
  }
  capabilities(): ConnectorCapabilities {
    return {
      id: 'postly',
      distributor: 'postly',
      dryRunDefault: true,
      liveAllowed: false,
      webhook: 'POST /webhooks/publish-postly',
      notes: 'Content OS path dry-run only. Live stays on the existing alias webhook.',
    };
  }
}

export class GumroadConnector implements Connector<LegacyPageInput> {
  id = 'gumroad' as const;
  validate(input: LegacyPageInput): ConnectorValidation {
    const parsed = parseNotionPage({ properties: input.properties || {} });
    const missing: string[] = [];
    if (parsed.is_incomplete) missing.push('Template / product fields');
    return { ok: missing.length === 0, missing };
  }
  async publish(input: LegacyPageInput, options: { dryRun: boolean }) {
    const parsed = parseNotionPage({ properties: input.properties || {} });
    if (options.dryRun) return dry({ kind: 'gumroad', parsed });
    throw new Error('Gumroad live publish goes through POST /webhooks/publish-gumroad (alias)');
  }
  capabilities(): ConnectorCapabilities {
    return {
      id: 'gumroad',
      distributor: 'gumroad',
      dryRunDefault: true,
      liveAllowed: false,
      webhook: 'POST /webhooks/publish-gumroad',
      notes: 'Content OS path dry-run only. Live stays on the existing alias webhook.',
    };
  }
}

export class LumaConnector implements Connector<LegacyPageInput> {
  id = 'luma' as const;
  validate(input: LegacyPageInput): ConnectorValidation {
    const content = extractLumaContent(input.properties || {});
    return { ok: content.is_complete, missing: content.missing };
  }
  async publish(input: LegacyPageInput, options: { dryRun: boolean }) {
    const content = extractLumaContent(input.properties || {});
    if (!content.is_complete) throw new Error(`Incomplete Luma: ${content.missing.join('; ')}`);
    if (options.dryRun || !env.LUMA_API_KEY) return dry({ kind: 'luma', content });
    throw new Error('Luma live publish goes through POST /webhooks/publish-luma (alias)');
  }
  capabilities(): ConnectorCapabilities {
    return {
      id: 'luma',
      distributor: 'luma',
      dryRunDefault: true,
      liveAllowed: false,
      webhook: 'POST /webhooks/publish-luma',
      notes: 'Content OS path dry-run only. Live stays on the existing alias webhook.',
    };
  }
}

export class GithubConnector implements Connector<LegacyPageInput> {
  id = 'github' as const;
  validate(input: LegacyPageInput): ConnectorValidation {
    const content = extractGithubPublishContent(input.properties || {});
    return { ok: content.is_complete, missing: content.missing };
  }
  async publish(input: LegacyPageInput, options: { dryRun: boolean }) {
    const content = extractGithubPublishContent(input.properties || {});
    if (!content.is_complete) throw new Error(`Incomplete GitHub: ${content.missing.join('; ')}`);
    if (options.dryRun) return dry({ kind: 'github', content });
    throw new Error('GitHub live publish goes through POST /webhooks/publish-github (alias)');
  }
  capabilities(): ConnectorCapabilities {
    return {
      id: 'github',
      distributor: 'github',
      dryRunDefault: true,
      liveAllowed: false,
      webhook: 'POST /webhooks/publish-github',
      notes: 'Content OS path dry-run only. Releases stay on the existing alias webhook.',
    };
  }
}
