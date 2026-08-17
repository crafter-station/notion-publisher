/**
 * ponytail: assert extractComposioRedditContent kind inference (no framework).
 * Run: npx ts-node --transpile-only scripts/check-composio-extract.ts
 */
import { extractComposioRedditContent } from '../src/services/notion.service';

function rt(s: string) {
  return { rich_text: [{ plain_text: s }] };
}
function url(u: string) {
  return { url: u };
}
function channels(...names: string[]) {
  return { multi_select: names.map(name => ({ name })) };
}

const self = extractComposioRedditContent({
  'Reddit Title': rt('Hello'),
  'Reddit Body': rt('Body text'),
  'Reddit Subreddit': rt('r/test'),
  Channels: channels('Reddit'),
});
if (self.kind !== 'self' || self.subreddit !== 'test' || !self.is_complete) {
  throw new Error(`self failed: ${JSON.stringify(self)}`);
}

const link = extractComposioRedditContent({
  'Reddit Title': rt('Link post'),
  'Reddit Subreddit': rt('test'),
  'Reddit Link URL': url('https://example.com/x'),
  Channels: channels('Reddit'),
});
if (link.kind !== 'link' || !link.is_complete) {
  throw new Error(`link failed: ${JSON.stringify(link)}`);
}

const forced = extractComposioRedditContent(
  {
    'Reddit Title': rt('Forced self'),
    'Reddit Body': rt('x'),
    'Reddit Subreddit': rt('test'),
    'Reddit Link URL': url('https://example.com'),
    Channels: channels('Reddit'),
  },
  { kind: 'self' }
);
if (forced.kind !== 'self' || !forced.is_complete) {
  throw new Error(`forced self failed: ${JSON.stringify(forced)}`);
}

console.log('[check-composio-extract] ok');
