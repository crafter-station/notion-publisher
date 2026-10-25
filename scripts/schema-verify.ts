/**
 * CI entry: npm run schema:verify
 * Fails if code reads Notion properties not declared in src/config/schema.ts.
 * Uses schema/notion-snapshot.json (Content OS dump) when present.
 */
import path from 'path';
import { formatVerifyReport, verifySchema } from '../src/schema/verify';

const rootDir = path.resolve(__dirname, '..');
const snapshotArg = process.argv.find(a => a.startsWith('--snapshot='));
const snapshotPath = snapshotArg
  ? path.resolve(rootDir, snapshotArg.slice('--snapshot='.length))
  : undefined;

const result = verifySchema({ rootDir, snapshotPath });
console.log(formatVerifyReport(result));

if (!result.ok) {
  process.exit(1);
}
