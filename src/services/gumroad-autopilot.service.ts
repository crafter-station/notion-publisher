import { env } from '../config/env';
import { executePublishProductUseCase } from '../use-cases/publish-product.use-case';
import { parseNotionPage, queryNextGumroadAutopilotCandidates, updateNotionMetadata } from './notion.service';
import {
  getGumroadAutopilotQuota,
  recordGumroadAutopilotFailure,
  recordGumroadAutopilotPublished,
} from './gumroad-autopilot-state.service';

export async function processNextGumroadAutopilotItem() {
  const databaseId = env.GUMROAD_AUTOPILOT_DATABASE_ID;
  if (!databaseId) {
    throw new Error('GUMROAD_AUTOPILOT_DATABASE_ID or NOTION_DATABASE_ID must be configured.');
  }

  const quota = getGumroadAutopilotQuota();
  if (quota.remaining <= 0) {
    console.log(`[GUMROAD-AUTOPILOT] Daily limit reached for ${quota.day_key}: ${quota.published}/${quota.limit}.`);
    return {
      status: 'daily-limit-reached',
      quota,
    };
  }

  const candidates = await queryNextGumroadAutopilotCandidates(databaseId, 10);
  console.log(`[GUMROAD-AUTOPILOT] Found ${candidates.length} candidate(s). Quota ${quota.published}/${quota.limit}.`);

  for (const page of candidates) {
    const record = parseNotionPage(page);
    const label = `${page.id} title="${record.title}"`;

    if (record.is_incomplete) {
      console.warn(`[GUMROAD-AUTOPILOT] Skipping incomplete candidate ${label}.`);
      continue;
    }

    console.log(`[GUMROAD-AUTOPILOT] Creating ${label} from GUMROAD_AUTOPILOT_DATABASE_ID. publishLive=${env.GUMROAD_AUTOPILOT_PUBLISH_LIVE ? 'true' : 'false'}`);

    await updateNotionMetadata(page.id, '', '', '', 'publishing');

    try {
      const result = await executePublishProductUseCase(page.id, page, {
        publishLive: env.GUMROAD_AUTOPILOT_PUBLISH_LIVE,
      });

      if (result?.status === 'published' || result?.status === 'draft-ready') {
        const updatedQuota = recordGumroadAutopilotPublished(page.id);
        return {
          status: result.status,
          page_id: page.id,
          product_id: result.product_id,
          url: result.url,
          quota: updatedQuota,
          source: 'GUMROAD_AUTOPILOT_DATABASE_ID',
        };
      }

      return {
        status: 'created-unpublished',
        page_id: page.id,
        product_id: result?.product_id,
        url: result?.url,
        quota: getGumroadAutopilotQuota(),
        source: 'GUMROAD_AUTOPILOT_DATABASE_ID',
      };
    } catch (error) {
      const updatedQuota = recordGumroadAutopilotFailure();
      throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
        gumroad_autopilot_quota: updatedQuota,
      });
    }
  }

  return {
    status: 'idle',
    checked_candidates: candidates.length,
    quota,
  };
}
