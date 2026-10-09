// Read-only audit: never imports the server or invokes publication buttons.
const fs = require('node:fs');
const dotenv = require('dotenv');
async function main() {
  const file = process.argv[2] || '.env';
  const env = { ...dotenv.parse(fs.readFileSync(file)), ...process.env };
  if (!env.NOTION_TOKEN || !env.NOTION_DATABASE_ID) throw new Error('Notion configuration missing');
  const headers = { Authorization: 'Bearer ' + env.NOTION_TOKEN, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' };
  const base = 'https://api.notion.com/v1/databases/' + encodeURIComponent(env.NOTION_DATABASE_ID);
  async function read(query) {
    const r = await fetch(base + (query ? '/query' : ''), { method: query ? 'POST' : 'GET', headers, ...(query ? { body: JSON.stringify(query) } : {}), signal: AbortSignal.timeout(20000), redirect: 'error' });
    if (!r.ok) throw new Error('Notion audit HTTP ' + r.status);
    return r.json();
  }
  const schema = await read();
  const sources = {}, statuses = {}, populated = {}, seen = new Set();
  let cursor, pages = 0, more = false;
  do {
    const result = await read({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
    for (const row of result.results) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      const tags = row.properties['Source Tags']?.multi_select || [];
      for (const source of tags.length ? tags.map(t => t.name) : ['(unassigned)']) sources[source] = (sources[source] || 0) + 1;
      const status = row.properties.Status?.status?.name || '(unassigned)';
      statuses[status] = (statuses[status] || 0) + 1;
      for (const [name, property] of Object.entries(row.properties)) {
        const v = property[property.type];
        if (['button', 'created_time', 'last_edited_time', 'created_by', 'last_edited_by'].includes(property.type)) continue;
        const nonempty = Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== '' && v !== false;
        if (nonempty) populated[name] = (populated[name] || 0) + 1;
      }
    }
    pages++; more = result.has_more; cursor = result.next_cursor;
    if (more && !cursor) throw new Error('Notion returned incomplete pagination');
    // Bounded diagnostic; never present a truncated traversal as complete.
    if (more && pages < 100) await new Promise(resolve => setTimeout(resolve, 400));
  } while (more && pages < 100);
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), readOnly: true, completeTraversal: !more, pages, rows: seen.size, sources, statuses, properties: Object.entries(schema.properties).map(([name, p]) => ({ name, type: p.type, populatedRows: populated[name] || 0 })) }, null, 2));
  if (more) process.exitCode = 1;
}
main().catch(() => { console.error('Notion inventory failed; no credential or upstream body exposed.'); process.exitCode = 1; });
