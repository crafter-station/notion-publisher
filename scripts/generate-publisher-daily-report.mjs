#!/usr/bin/env node
import fs from 'fs';
import http from 'http';
import path from 'path';

const REPO_ROOT = process.cwd();
const REPORT_DIR = path.join(REPO_ROOT, 'reports', 'publisher-daily');
const STATE_PATH = path.join(REPO_ROOT, 'data', 'gumroad-autopilot-state.json');
const SERVER_LOG_PATH = '/tmp/notion-publisher-server.log';
const NGROK_API_URL = 'http://127.0.0.1:4040/api/tunnels';
const TIME_ZONE = process.env.PUBLISHER_REPORT_TIMEZONE || 'America/Lima';

function getDayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function readTail(filePath, maxLines = 160) {
  try {
    return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).slice(-maxLines);
  } catch {
    return [];
  }
}

function getNgrokTunnels() {
  return new Promise(resolve => {
    const req = http.get(NGROK_API_URL, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve((data.tunnels || []).map(tunnel => ({
            public_url: tunnel.public_url,
            proto: tunnel.proto,
            addr: tunnel.config?.addr,
          })));
        } catch {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
    req.setTimeout(2500, () => {
      req.destroy();
      resolve([]);
    });
  });
}

function getTodayLogFacts(lines) {
  const created = [];
  let postlyTicks = 0;
  let gumroadTicks = 0;
  let failures = 0;

  for (const line of lines) {
    if (line.includes('[POSTLY-QUEUE] Tick finished')) postlyTicks += 1;
    if (line.includes('[GUMROAD-AUTOPILOT] Tick finished')) gumroadTicks += 1;
    if (/failed|error/i.test(line)) failures += 1;

    const match = line.match(/Draft ready for manual publish at (https:\/\/\S+)/);
    if (match) created.push(match[1]);
  }

  return {
    postlyTicks,
    gumroadTicks,
    failures,
    recentDraftUrls: [...new Set(created)].slice(-10),
  };
}

function formatList(items, emptyText) {
  if (!items.length) return `- ${emptyText}`;
  return items.map(item => `- ${item}`).join('\n');
}

const dayKey = getDayKey();
const state = readJson(STATE_PATH, { days: {} });
const dayState = state.days?.[dayKey] || { published: 0, page_ids: [], failures: 0 };
const logFacts = getTodayLogFacts(readTail(SERVER_LOG_PATH));
const tunnels = await getNgrokTunnels();

fs.mkdirSync(REPORT_DIR, { recursive: true });

const report = `# Publisher Daily Report - ${dayKey}

Generated: ${new Date().toISOString()}
Timezone: ${TIME_ZONE}

## Gumroad Autopilot

- Daily draft quota used: ${dayState.published || 0}/10
- Remaining draft quota: ${Math.max(0, 10 - (dayState.published || 0))}
- Recorded failures: ${dayState.failures || 0}
- Recorded page ids: ${(dayState.page_ids || []).length}
- Recent Gumroad ticks in log tail: ${logFacts.gumroadTicks}

## Postly Queue

- Recent Postly ticks in log tail: ${logFacts.postlyTicks}
- Errors/failures seen in log tail: ${logFacts.failures}

## Ngrok

${formatList(tunnels.map(tunnel => `${tunnel.public_url} -> ${tunnel.addr}`), 'No active ngrok tunnel detected from local API')}

## Recent Drafts

${formatList(logFacts.recentDraftUrls, 'No draft URLs found in current log tail')}
`;

const reportPath = path.join(REPORT_DIR, `${dayKey}.md`);
fs.writeFileSync(reportPath, report);
console.log(reportPath);

