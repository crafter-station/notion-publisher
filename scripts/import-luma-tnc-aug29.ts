/**
 * One-shot: mirror five Aug-29 The Next Craft Luma events → Publisher Notion rows.
 * Idempotent on Luma Event URL. Does NOT recreate events on Luma.
 *
 * Usage: npm run luma:import-tnc
 */
import 'dotenv/config';
import { LumaService } from '../src/services/luma.service';
import {
  createPublisherLumaPage,
  findPublisherPageByLumaUrl,
} from '../src/services/notion.service';

const TNC_EVENT_IDS = new Set([
  'evt-1MGHQUyZRTbetjz', // Arequipa
  'evt-VY39qs3m0xyxTDK', // El Salvador
  'evt-pI2evFs4871pnFC', // Lima
  'evt-yOQFvwUmtTrKAA0', // Bogotá
  'evt-pGqaBUD60Epdarr', // Ciudad de Guatemala
]);

function locationFromEvent(ev: any): string {
  const geo = ev.geo_address_json;
  if (geo?.address) return String(geo.address);
  if (geo?.description) return String(geo.description);
  if (ev.meeting_url) return String(ev.meeting_url);
  return '';
}

async function main() {
  const luma = new LumaService();
  const listed = await luma.listCalendarEvents();
  const targets = listed.filter(ev => TNC_EVENT_IDS.has(ev.id));

  console.log(`[import] listed=${listed.length} tnc_matched=${targets.length}`);

  // Fill missing via getEvent (list payload may omit cover/description)
  const rich: any[] = [];
  for (const ev of targets) {
    try {
      const detail = await luma.getEvent(ev.id);
      rich.push({ ...ev, ...detail });
    } catch (err: any) {
      console.warn(`[import] getEvent ${ev.id} failed: ${err.message}; using list row`);
      rich.push(ev);
    }
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const ev of rich) {
    const url = ev.url;
    if (!url) {
      console.warn(`[import] skip ${ev.id}: no url`);
      failed++;
      continue;
    }

    const existing = await findPublisherPageByLumaUrl(url);
    if (existing) {
      console.log(`[import] skip exists ${ev.name} → ${existing}`);
      skipped++;
      continue;
    }

    const result = await createPublisherLumaPage({
      name: ev.name || ev.id,
      start_at: ev.start_at,
      end_at: ev.end_at,
      location: locationFromEvent(ev),
      description_md: ev.description_md || ev.description || '',
      cover_url: ev.cover_url || undefined,
      luma_url: url,
      luma_status: 'Published',
      final_status: 'Published',
    });

    if (!result.success) {
      console.error(`[import] FAIL ${ev.name}: ${result.error}`);
      failed++;
      continue;
    }

    console.log(`[import] created ${ev.name} → ${result.page_id}`);
    created++;
  }

  console.log(`[import] done created=${created} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('[import] fatal', err);
  process.exit(1);
});
