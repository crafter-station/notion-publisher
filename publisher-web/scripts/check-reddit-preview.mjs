import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile, unlink} from 'node:fs/promises';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const read = p => readFile(new URL('../'+p, import.meta.url), 'utf8');
const source = await read('lib/reddit-preview.ts') + '\n' + (await read('components/reddit-preview.tsx')).replace("import { redditPreview } from '../lib/reddit-preview';", '');
const output = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const file = new URL('../.wrangler/reddit-preview-check.mjs', import.meta.url);
await mkdir(new URL('../.wrangler/', import.meta.url), {recursive:true});
await writeFile(file, output);
try {
  const {redditPreview, RedditPreview} = await import(file.href);
  const settings = {reddit_title:'Title', reddit_subreddit:'r/test', reddit_kind:'self'};
  assert.deepEqual(redditPreview('Fallback','Text',settings).issues, []);
  assert.equal(redditPreview('Fallback','Text',{}).title,'Fallback');
  assert.equal(redditPreview('Title','Text',{reddit_link:'https://example.com'}).kind,'link');
  assert.equal(redditPreview('Title','Text',{...settings,reddit_link:'https://example.com'}).kind,'self');
  assert.ok(redditPreview('','',{}).issues.length >= 3);
  assert.ok(redditPreview('x'.repeat(301),'x'.repeat(40001),{}).issues.length >= 3);
  assert.equal(redditPreview('😀'.repeat(300),'Text',{reddit_subreddit:'test'}).issues.length,0);
  for (const link of ['javascript:alert(1)','https://user:password@example.com','not a url']) {
    assert.equal(redditPreview('Title','Text',{reddit_kind:'link',reddit_link:link}).url,null);
  }
  const render = (body, overrides={}) => renderToStaticMarkup(createElement(RedditPreview,{title:'Fallback', body, settings, linked:false, inherited:false,...overrides}));
  const html = render('**Bold**\n\n- First\n- Second\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\n![photo](https://example.com/remote.png)');
  assert.ok(html.includes('<strong>Bold</strong>'));
  assert.ok(html.includes('<li>First</li>'));
  assert.ok(html.includes('r/test'));
  assert.ok(html.includes('<h3>Title</h3>'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(!html.includes('<img'));
  const linkHtml = render('Hidden link body',{settings:{...settings,reddit_kind:'link',reddit_link:'https://example.com/article'}});
  assert.ok(linkHtml.includes('href="https://example.com/article"'));
  assert.ok(!linkHtml.includes('Hidden link body'));
  assert.ok(render('Text',{linked:true,inherited:true}).includes('Personalizar texto'));
  console.log('Reddit preview: text/link selection, field limits, fallback title, Markdown, unsafe URLs/HTML and Notion caveats passed.');
} finally {await unlink(file);}
