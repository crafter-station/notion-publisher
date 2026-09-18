// Read-only: exactly one Notion GET; never invokes Composio or writes a page.
require('ts-node/register/transpile-only');
const fs = require('node:fs');
const dotenv = require('dotenv');
const { extractComposioRedditContent } = require('../src/services/reddit-content');
const uuid = /^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;
const normalize = id => id.replace(/-/g, '').toLowerCase();
async function previewRedditNotion(config, pageId, fetchImpl = fetch) {
  if (!uuid.test(pageId || '')) throw new Error('Invalid Notion page ID');
  if (!config.NOTION_TOKEN || !uuid.test(config.NOTION_DATABASE_ID || '')) throw new Error('NOTION_TOKEN and a valid NOTION_DATABASE_ID are required');
  let response;
  try {
    response = await fetchImpl(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'GET', headers: { Authorization: `Bearer ${config.NOTION_TOKEN}`, 'Notion-Version': '2022-06-28' },
      redirect: 'error', signal: AbortSignal.timeout(20000),
    });
  } catch { throw new Error('Notion read failed: network or redirect error'); }
  if (!response.ok) throw new Error(`Notion read failed: HTTP ${response.status}`);
  let page;
  try { page = await response.json(); } catch { throw new Error('Notion returned invalid JSON'); }
  if (!page || page.object !== 'page' || !uuid.test(page.id || '') || normalize(page.id) !== normalize(pageId)) throw new Error('Notion returned an unexpected page');
  if (!uuid.test(page.parent?.database_id || '') || normalize(page.parent.database_id) !== normalize(config.NOTION_DATABASE_ID)) throw new Error('Page is outside the configured Publisher database');
  if (page.archived || page.in_trash) throw new Error('Page is archived or in trash');
  if (!page.properties || typeof page.properties !== 'object' || Array.isArray(page.properties)) throw new Error('Notion page properties are missing');
  let content;
  try { content = extractComposioRedditContent(page.properties, { defaultSubreddit: config.COMPOSIO_REDDIT_SUBREDDIT }); }
  catch { throw new Error('Notion page properties are malformed'); }
  const issues = [...content.missing];
  if (!content.channels.includes('Reddit')) issues.push('Channels must include Reddit');
  if (!page.properties['Source Tags']?.multi_select?.some(item => item.name === 'Composio')) issues.push('Source Tags must include Composio');
  return {
    mode: 'preview', notionPageId: page.id, contentValid: content.is_complete,
    routingValid: content.channels.includes('Reddit') && !!page.properties['Source Tags']?.multi_select?.some(item => item.name === 'Composio'),
    issues,
    payload: {
      title: content.title, subreddit: content.subreddit, kind: content.kind,
      ...(content.flair_id ? { flair_id: content.flair_id } : {}),
      ...(content.kind === 'self' ? { text: content.body } : { url: content.link_url }),
    },
    verification: 'Content and Notion routing only. Account identity, community permissions and publishing are not verified.',
  };
}
async function main() {
  const [envFile, pageId, ...extra] = process.argv.slice(2);
  if (!envFile || !pageId || extra.length) throw new Error('Usage: node scripts/preview-reddit-notion.cjs ENV_FILE NOTION_PAGE_ID');
  let parsed;
  try { parsed = dotenv.parse(fs.readFileSync(envFile)); } catch { throw new Error('Cannot read environment file'); }
  const result = await previewRedditNotion({ ...parsed, ...process.env }, pageId);
  console.log(JSON.stringify(result, null, 2));
  if (result.issues.length) process.exitCode = 1;
}
module.exports = { previewRedditNotion };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
