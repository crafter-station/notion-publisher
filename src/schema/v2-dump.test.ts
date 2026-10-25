import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { SCHEMA_BASES, SchemaBaseId } from '../config/schema';
import { normalizeSnapshotType } from './verify';

type DumpProp = { name: string; type: string };
type DumpFile = {
  bases: Partial<Record<SchemaBaseId, DumpProp[]>>;
};

test('schema module includes every v2 dump property with a matching type', () => {
  const dumpPath = path.join(process.cwd(), 'schema/notion-dumps-v2.json');
  const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf8')) as DumpFile;
  const missing: string[] = [];
  const typeMismatches: string[] = [];

  for (const [baseId, props] of Object.entries(dump.bases)) {
    const schema = SCHEMA_BASES[baseId as SchemaBaseId];
    assert.ok(schema, `unknown dump base ${baseId}`);
    const byName = new Map(Object.values(schema.properties).map(p => [p.name, p.type]));
    for (const prop of props || []) {
      const schemaType = byName.get(prop.name);
      if (!schemaType) {
        missing.push(`${baseId} ${JSON.stringify(prop.name)}`);
        continue;
      }
      const dumpType = normalizeSnapshotType(prop.type);
      if (dumpType !== schemaType) {
        typeMismatches.push(
          `${baseId} ${JSON.stringify(prop.name)} dump=${dumpType} schema=${schemaType}`
        );
      }
    }
  }

  assert.deepEqual(missing, [], `v2 dump properties missing from schema:\n${missing.join('\n')}`);
  assert.deepEqual(typeMismatches, [], `v2 dump type mismatches:\n${typeMismatches.join('\n')}`);
});
