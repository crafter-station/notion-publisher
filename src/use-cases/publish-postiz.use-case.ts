import { env } from '../config/env';
import { isDryRun, PublishModeOptions } from '../connectors/dry-run';
import {
  extractPostizContent,
  getNotionPage,
  updatePostizMetadata,
} from '../services/notion.service';
import {
  getPostizChannel,
  POSTIZ_CHANNEL_CATALOG,
} from '../services/postiz-channels.catalog';
import {
  PostizChannelInput,
  PostizService,
  resolvePostizIntegrations,
} from '../services/postiz.service';

export type PublishPostizOptions = PublishModeOptions & {
  /** Subset of catalog identifiers. Default: Notion targets ∩ wired integrations. */
  targets?: string[];
};

function resolveTargets(contentTargets: string[], explicit?: string[]): string[] {
  if (explicit?.length) return explicit.map(t => t.toLowerCase());
  const fromNotion = contentTargets
    .map(t => getPostizChannel(t)?.identifier)
    .filter((id): id is string => !!id);
  if (fromNotion.length) return fromNotion;
  return resolvePostizIntegrations().map(i => i.identifier);
}

function toChannelInputs(
  content: ReturnType<typeof extractPostizContent>,
  targets: string[]
): PostizChannelInput[] {
  const envIntegrations = Object.fromEntries(
    resolvePostizIntegrations().map(i => [i.identifier, i.id])
  );

  return targets.map(identifier => {
    const spec = getPostizChannel(identifier);
    if (!spec) {
      throw new Error(`Unsupported Postiz target: ${identifier}`);
    }
    const integration_id = content.integration_ids[spec.identifier] || envIntegrations[spec.identifier] || '';
    const text = content.overrides[spec.identifier] || content.caption;
    return {
      identifier: spec.identifier,
      integration_id,
      content: text,
      settings: content.settings[spec.identifier] || {},
    };
  });
}

/**
 * Build (and optionally create) a Postiz post from Publisher Notion props.
 * Dry-run is the default and never calls POST /posts.
 */
export async function executePublishPostizUseCase(
  notion_page_id: string,
  options: PublishPostizOptions = {}
) {
  console.log(`[INFO] Postiz publish start (notionPageId: ${notion_page_id}, dryRun=${isDryRun(options)})`);

  const page = await getNotionPage(notion_page_id);
  const content = extractPostizContent(page?.properties || {});

  if (!content.is_complete) {
    await updatePostizMetadata(notion_page_id, {
      postiz_status: 'Failed',
      final_status: 'Error',
    });
    throw new Error(`Incomplete Postiz content: ${content.missing.join('; ')}`);
  }

  const targets = resolveTargets(content.targets, options.targets);
  if (!targets.length) {
    throw new Error(
      'No Postiz targets. Set Postiz Targets / Channels or POSTIZ_INTEGRATIONS=identifier:id'
    );
  }

  const unknown = targets.filter(t => !POSTIZ_CHANNEL_CATALOG.some(c => c.identifier === t));
  if (unknown.length) {
    throw new Error(`Postiz targets not in wired catalog: ${unknown.join(', ')}`);
  }

  const postiz = new PostizService();
  const result = await postiz.createPost(
    {
      type: content.schedule_at ? 'schedule' : 'draft',
      date: content.schedule_at || undefined,
      channels: toChannelInputs(content, targets),
    },
    options
  );

  if (result.dry_run) {
    console.log(
      `[INFO] Postiz dry-run ok (${notion_page_id}) channels=${result.payload.posts
        .map(p => p.settings.__type)
        .join(',')} type=${result.payload.type}`
    );
    return result;
  }

  await updatePostizMetadata(notion_page_id, {
    postiz_status: 'Published',
    postiz_urls: JSON.stringify(result.response).slice(0, 1900),
    final_status: 'Published',
  });
  console.log(`[INFO] Postiz live create ok (${notion_page_id})`);
  return result;
}

export function postizLiveGateOpen(): boolean {
  return env.POSTIZ_PUBLISH_LIVE === 'true';
}
