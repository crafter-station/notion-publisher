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

const flairId = 'a1b2c3d4-e5f6-7890-1234-567890abcdef';
const explicitProps = {
  'Reddit Title': rt('Explicit text'),
  'Reddit Body': rt('Body'),
  'Reddit Subreddit': rt('r/test'),
  'Reddit Link URL': url('https://example.com'),
  'Reddit Post Type': { select: { name: 'self' } },
  'Reddit Flair ID': rt(flairId),
};
const explicit = extractComposioRedditContent(explicitProps);
if (explicit.kind !== 'self' || explicit.flair_id !== flairId || !explicit.is_complete) throw new Error('Explicit type and flair lost');
for (const overrides of [
  { 'Reddit Title': rt('x'.repeat(301)) },
  { 'Reddit Title': rt('   ') },
  { 'Reddit Body': rt('x'.repeat(40001)) },
  { 'Reddit Subreddit': rt('https://reddit.com/r/test') },
  { 'Reddit Flair ID': rt('news') },
  { 'Reddit Post Type': { select: { name: 'video' } } },
  { 'Reddit Post Type': { select: { name: 'link' } }, 'Reddit Link URL': url('javascript:alert(1)') },
]) {
  if (extractComposioRedditContent({ ...explicitProps, ...overrides }).is_complete) throw new Error('Invalid Reddit fields accepted');
}
console.log('[check-composio-extract] explicit type, flair and validation ok');
