import { isDryRun, PublishModeOptions } from '../connectors/dry-run';
import {
  extractRestreamContent,
  getNotionPage,
  updateRestreamMetadata,
} from '../services/notion.service';
import { RestreamService } from '../services/restream.service';

/**
 * Build a Restream create/schedule event payload from Notion.
 * Always dry-run — never POST /user/events/new. No go-live. No StreamYard.
 */
export async function executePublishRestreamUseCase(
  notion_page_id: string,
  options: PublishModeOptions = {}
) {
  const dryRun = isDryRun(options);
  console.log(`[INFO] Restream publish start (notionPageId: ${notion_page_id}, dryRun=${dryRun})`);

  const page = await getNotionPage(notion_page_id);
  const content = extractRestreamContent(page?.properties || {});

  if (!content.is_complete) {
    await updateRestreamMetadata(notion_page_id, {
      restream_status: 'Failed',
      final_status: 'Error',
    });
    throw new Error(`Incomplete Restream content: ${content.missing.join('; ')}`);
  }

  const service = new RestreamService();
  const result = await service.createEvent(
    {
      title: content.title,
      description: content.description || undefined,
      scheduledFor: content.scheduled_for || undefined,
      streamType: content.stream_type,
      fileId: content.file_id || undefined,
    },
    { dryRun: true }
  );

  console.log(
    `[INFO] Restream dry-run ok (${notion_page_id}) streamType=${result.payload.streamType} title=${result.payload.title}`
  );
  return result;
}
