/**
 * CI entry: npm run schema:verify
 * Fails if code reads Notion properties not declared in src/config/schema.ts.
 * Uses schema/notion-snapshot.json (Content OS dump) when present.
 */
import path from 'path';
import { isDeclaredPropertyName } from '../src/config/schema';
import { formatVerifyReport, verifySchema } from '../src/schema/verify';

const rootDir = path.resolve(__dirname, '..');
const snapshotArg = process.argv.find(a => a.startsWith('--snapshot='));
const snapshotPath = snapshotArg
  ? path.resolve(rootDir, snapshotArg.slice('--snapshot='.length))
  : undefined;

const REQUIRED_PUBLISHER_PROPERTIES = ['Post ID', 'Postly Plan'];
const missingRequired = REQUIRED_PUBLISHER_PROPERTIES.filter(
  name => !isDeclaredPropertyName(name, 'publisher')
);
if (missingRequired.length) {
  console.error(`schema:verify missing Publisher properties: ${missingRequired.join(', ')}`);
  process.exit(1);
}

const result = verifySchema({ rootDir, snapshotPath });
console.log(formatVerifyReport(result));

if (!result.ok) {
  process.exit(1);
}
