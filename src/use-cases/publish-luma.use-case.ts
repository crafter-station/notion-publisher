import { LumaService } from '../services/luma.service';
import {
  extractLumaContent,
  getNotionPage,
  updateLumaMetadata,
} from '../services/notion.service';

export type PublishLumaOptions = {
  /** Smoke / tests — default omit (Luma calendar default). */
  visibility?: 'public' | 'members-only' | 'private';
};

/**
 * Create a Luma event from Publisher Notion props; write back status + URL.
 * Cover: upload Notion file URL to Luma CDN when present.
 * Out of scope: update-existing, invitations, tickets.
 */
export async function executePublishLumaUseCase(
  notion_page_id: string,
  options: PublishLumaOptions = {}
): Promise<void> {
  console.log(`[INFO] Luma publish start (notionPageId: ${notion_page_id})`);

  await updateLumaMetadata(notion_page_id, { luma_status: 'In progress' });

  try {
    const page = await getNotionPage(notion_page_id);
    const content = extractLumaContent(page?.properties || {});

    if (!content.is_complete) {
      await updateLumaMetadata(notion_page_id, {
        luma_status: 'Failed',
        final_status: 'Error',
      });
      console.error(
        `[ERROR] Incomplete Luma content for ${notion_page_id}: ${content.missing.join('; ')}`
      );
      return;
    }

    const luma = new LumaService();

    let cover_url: string | undefined;
    if (content.cover_url) {
      try {
        cover_url = await luma.uploadCoverFromSource(content.cover_url);
        console.log(`[INFO] Luma cover uploaded for ${notion_page_id}`);
      } catch (err: any) {
        console.warn(
          `[WARN] Luma cover upload failed (continuing without cover): ${err.message}`
        );
      }
    }

    const created = await luma.createEvent({
      name: content.name,
      start_at: content.start_at,
      end_at: content.end_at || undefined,
      timezone: content.timezone,
      description_md: content.description_md || undefined,
      location: content.location || undefined,
      cover_url,
      visibility: options.visibility,
    });

    let eventUrl = '';
    try {
      const detail = await luma.getEvent(created.id);
      eventUrl = detail?.url || '';
    } catch (err: any) {
      console.warn(`[WARN] Luma getEvent after create failed: ${err.message}`);
    }

    await updateLumaMetadata(notion_page_id, {
      luma_status: 'Published',
      luma_url: eventUrl || undefined,
      final_status: 'Published',
    });

    console.log(
      `[INFO] Luma publish ok (notionPageId: ${notion_page_id}, eventId: ${created.id}, url: ${eventUrl || 'n/a'})`
    );
  } catch (err: any) {
    console.error(`[ERROR] Luma publish failed for ${notion_page_id}:`, err.message || err);
    await updateLumaMetadata(notion_page_id, {
      luma_status: 'Failed',
      final_status: 'Error',
    }).catch((e: any) => console.warn('[WARN] Luma failure writeback failed', e.message));
  }
}
