import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { test } from 'node:test';

const FORBIDDEN = /Nucleo-Lab\/notion-publisher|github\.com\/Nucleo-Lab\/|github\.com\/orgs\/Nucleo-Lab\//;
const ROOTS = ['README.md', 'docs', 'package.json', '.env.example', 'scripts', '.github'];
const SKIP_DIR = new Set(['node_modules', 'dist', '.git']);

function walk(rel: string, files: string[]): void {
  const full = path.join(process.cwd(), rel);
  if (!fs.existsSync(full)) return;
  const stat = fs.statSync(full);
  if (stat.isDirectory()) {
    if (SKIP_DIR.has(path.basename(full))) return;
    for (const entry of fs.readdirSync(full)) walk(path.join(rel, entry), files);
    return;
  }
  files.push(rel);
}

test('docs and scripts do not link the old Nucleo-Lab/notion-publisher repo', () => {
  const files: string[] = [];
  for (const root of ROOTS) walk(root, files);
  const hits: string[] = [];
  for (const file of files) {
    const text = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    for (const [i, line] of text.split(/\r?\n/).entries()) {
      if (FORBIDDEN.test(line)) hits.push(`${file}:${i + 1}:${line.trim()}`);
    }
  }
  assert.deepEqual(hits, [], `replace Nucleo-Lab repo links with crafter-station/notion-publisher:\n${hits.join('\n')}`);
});
