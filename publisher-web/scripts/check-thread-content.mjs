import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';
const source = await readFile(
  new URL('../lib/thread-content.ts', import.meta.url),
  'utf8',
);
const js = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { threadPosts, threadText, threadChannels } = await import(
  'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
);
for (const posts of [
  [''],
  ['One'],
  ['One', 'Two'],
  ['One', '', 'Three'],
  ['', 'Second', ''],
  ['Paragraph\n\nAnother', 'Emoji 👩🏽‍💻'],
])
  assert.deepEqual(threadPosts(threadText(posts)), posts);
assert.deepEqual(threadPosts('First\r\n\r\n\r\n\r\nSecond'), [
  'First',
  'Second',
]);
assert.deepEqual(threadPosts('Paragraph\n\nAnother'), ['Paragraph\n\nAnother']);
assert(!threadChannels.includes('Substack'));
console.log(
  'Thread content preserves order, paragraphs, Unicode and empty intermediate posts across storage round trips.',
);
