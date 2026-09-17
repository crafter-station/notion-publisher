import assert from 'node:assert/strict';
import { ComposioService } from '../src/services/composio.service';
import { buildIngestPages } from '../src/services/to-cms-ingest';
async function main() {
  const service = new ComposioService('fixture');
  let captured: any;
  service.executeTool = async (slug, options) => { captured = { slug, ...options }; return { successful: true, raw: {} }; };
  const title = '😀'.repeat(300), flair = 'a1b2c3d4-e5f6-7890-1234-567890abcdef';
  await service.createRedditPost({ title, subreddit: 'r/test', kind: 'self', text: 'Body', flair_id: flair }, { userId: 'owner', connectedAccountId: 'account' });
  assert.equal(captured.arguments.title, title);
  assert.equal(captured.arguments.flair_id, flair);
  assert.equal(captured.arguments.subreddit, 'test');
  assert.throws(() => service.createRedditPost({ title: 'x'.repeat(301), subreddit: 'test' }, { userId: 'owner' }));
  const pages = buildIngestPages({ pages: [{ title: 'Fixture', layer: 'Social', sources: ['Composio'], channels: ['Reddit'], statusProps: [], fields: { 'Reddit Post Type': 'self', 'Reddit Flair ID': flair } }] } as any);
  assert.deepEqual(pages[0].properties['Reddit Post Type'], { select: { name: 'self' } });
  assert.deepEqual(pages[0].properties['Reddit Flair ID'], { rich_text: [{ text: { content: flair } }] });
  console.log('Reddit ingestion and payload preserve type, flair and Unicode title; no network calls.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
