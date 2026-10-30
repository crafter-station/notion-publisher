import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scanFileForPropertyNames, uniqueScannedNames } from './scan-properties';
import { formatVerifyReport, verifySchema } from './verify';
import { listDeclaredPropertyNames } from '../config/schema';

test('scanner picks Notion property reads and ignores headers', () => {
  const source = `
    const caption = _richText(props['Caption']);
    filter: { property: 'Restream Title', rich_text: { is_not_empty: true } },
    properties['Postiz Publish Status'] = { status: { name: 'Failed' } };
    'Typefully URL': { url: data.typefully_url },
    headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' };
  `;
  const hits = scanFileForPropertyNames('src/services/notion.service.ts', source);
  const names = uniqueScannedNames(hits);
  assert.deepEqual(names, [
    'Caption',
    'Postiz Publish Status',
    'Restream Title',
    'Typefully URL',
  ]);
});

test('schema declares Postly Plan so scanned writes stay legal', () => {
  const declared = new Set(listDeclaredPropertyNames('publisher'));
  assert.ok(declared.has('Postly Plan'));
  assert.ok(declared.has('Post ID'));
});

test('verify fails when code reads an undeclared property', () => {
  const rootDir = process.cwd();
  const declared = new Set(listDeclaredPropertyNames());
  assert.ok(!declared.has('This Property Does Not Exist'));

  const result = verifySchema({ rootDir });
  assert.equal(result.undeclared.some(u => u.name === 'This Property Does Not Exist'), false);
  assert.ok(result.ok, formatVerifyReport(result));
});
