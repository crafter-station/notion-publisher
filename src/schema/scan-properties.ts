/**
 * Static scan of TypeScript sources for Notion property names the code reads.
 * Patterns match the existing Publisher extract/query/write style.
 */

import fs from 'fs';
import path from 'path';

const PROPERTY_PATTERNS: RegExp[] = [
  /\bprops\[['"']([^'"]+)['"']\]/g,
  /\bproperties\[['"']([^'"]+)['"']\]/g,
  /\bproperty:\s*['"']([^'"]+)['"']/g,
  /['"']([^'"]+)['"']\s*:\s*\{\s*(?:status|url|rich_text|select|multi_select|date|title|files|checkbox|relation)\b/g,
];

const SKIP_DIR_NAMES = new Set(['node_modules', 'dist', '.git', 'data', 'downloads']);

const SKIP_FILE_SUFFIXES = ['.test.ts', '.test.js'];

export type ScannedProperty = {
  name: string;
  file: string;
  line: number;
};

function shouldScanFile(filePath: string, includeTests: boolean): boolean {
  if (!/\.(ts|js)$/.test(filePath)) return false;
  if (!includeTests && SKIP_FILE_SUFFIXES.some(s => filePath.endsWith(s))) return false;
  return true;
}

function walk(dir: string, files: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR_NAMES.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
}

export function scanSourceFiles(rootDir: string, includeTests = false): string[] {
  const files: string[] = [];
  walk(rootDir, files);
  return files.filter(f => shouldScanFile(f, includeTests));
}

export function scanFileForPropertyNames(filePath: string, source: string): ScannedProperty[] {
  const hits: ScannedProperty[] = [];
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue;
    for (const pattern of PROPERTY_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(line))) {
        const name = match[1];
        if (!name || name.length < 2) continue;
        hits.push({ name, file: filePath, line: i + 1 });
      }
    }
  }
  return hits;
}

export function scanPropertyReads(
  rootDir: string,
  options: { includeTests?: boolean } = {}
): ScannedProperty[] {
  const files = scanSourceFiles(rootDir, options.includeTests === true);
  const hits: ScannedProperty[] = [];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    hits.push(...scanFileForPropertyNames(path.relative(rootDir, file), source));
  }
  return hits;
}

export function uniqueScannedNames(hits: ScannedProperty[]): string[] {
  return [...new Set(hits.map(h => h.name))].sort((a, b) => a.localeCompare(b));
}
