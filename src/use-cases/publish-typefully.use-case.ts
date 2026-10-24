import { isDryRun, PublishModeOptions } from '../connectors/dry-run';
import {
  extractTypefullyContent,
  getNotionPage,
  updateTypefullyMetadata,
} from '../services/notion.service';
import { parseTypefullySocialSetId, TypefullyService } from '../services/typefully.service';

/**
 * Create a Typefully draft from Publisher Notion props.
 * Dry-run is the default and never calls the drafts endpoint.
 * Live still omits publish_at (draft / plan_at only).
 */
export async function executePublishTypefullyUseCase(
  notion_page_id: string,
  options: PublishModeOptions = {}
) {
  console.log(
    `[INFO] Typefully publish start (notionPageId: ${notion_page_id}, dryRun=${isDryRun(options)})`
  );

  const page = await getNotionPage(notion_page_id);
  const content = extractTypefullyContent(page?.properties || {});

  if (!content.is_complete) {
    await updateTypefullyMetadata(notion_page_id, {
      typefully_status: 'Failed',
      final_status: 'Error',
    });
    throw new Error(`Incomplete Typefully content: ${content.missing.join('; ')}`);
  }

  const service = new TypefullyService();
  const result = await service.createDraft(
    {
      social_set_id: parseTypefullySocialSetId(content.social_set_id),
      draft_title: content.draft_title,
      plan_at: content.plan_at || undefined,
      platforms: content.platforms,
    },
    options
  );

  if (result.dry_run) {
    console.log(
      `[INFO] Typefully dry-run ok (${notion_page_id}) platforms=${Object.keys(
        result.payload.platforms
      ).join(',')}`
    );
    return result;
  }

  const url =
    (result.response as any)?.private_url ||
    (result.response as any)?.share_url ||
    undefined;
  await updateTypefullyMetadata(notion_page_id, {
    typefully_status: 'Published',
    typefully_url: url,
    final_status: 'Published',
  });
  return result;
}
