/**
 * schema:verify — fail if code reads Notion properties not declared
 * in the central schema. When a snapshot is present, also compare
 * declared names against the fetched Notion schema (warnings for
 * schema-only extras that are not in Notion yet).
 */

import fs from 'fs';
import path from 'path';
import {
  CONTENT_OS_BASE_IDS,
  listDeclaredPropertyNames,
  SCHEMA_BASES,
  SNAPSHOT_RELATIVE_PATH,
  SchemaBaseId,
} from '../config/schema';
import { scanPropertyReads, ScannedProperty, uniqueScannedNames } from './scan-properties';

export const DEFAULT_SNAPSHOT_PATH = SNAPSHOT_RELATIVE_PATH;

export type SchemaSnapshotProperty = { name: string; type: string };
export type SchemaSnapshotBase = {
  id?: string;
  id_suffix?: string;
  title?: string;
  properties: SchemaSnapshotProperty[];
};
export type SchemaSnapshot = {
  generated_at?: string;
  notion_version?: string;
  bases: Partial<Record<SchemaBaseId, SchemaSnapshotBase>>;
};

export type VerifyResult = {
  ok: boolean;
  scanned: string[];
  undeclared: Array<{ name: string; files: string[] }>;
  snapshotPath: string | null;
  snapshotMissingForCode: Array<{ base: string; name: string }>;
  schemaOnlyWarnings: Array<{ base: string; name: string }>;
  typeMismatches: Array<{ base: string; name: string; schemaType: string; snapshotType: string }>;
};

export function loadSnapshot(snapshotPath: string): SchemaSnapshot | null {
  if (!fs.existsSync(snapshotPath)) return null;
  const raw = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  if (!raw || typeof raw !== 'object' || !raw.bases) {
    throw new Error(`Invalid schema snapshot at ${snapshotPath}`);
  }
  return raw as SchemaSnapshot;
}

/** MCP dumps use text/file; Notion API uses rich_text/files. */
export function normalizeSnapshotType(type: string): string {
  if (type === 'text') return 'rich_text';
  if (type === 'file') return 'files';
  return type;
}

function filesForName(hits: ScannedProperty[], name: string): string[] {
  return [...new Set(hits.filter(h => h.name === name).map(h => `${h.file}:${h.line}`))];
}

export function verifySchema(options: {
  rootDir: string;
  snapshotPath?: string;
  includeTests?: boolean;
}): VerifyResult {
  const hits = scanPropertyReads(options.rootDir, { includeTests: options.includeTests });
  const scanned = uniqueScannedNames(hits);
  const declared = new Set(listDeclaredPropertyNames());
  const undeclared = scanned
    .filter(name => !declared.has(name))
    .map(name => ({ name, files: filesForName(hits, name) }));

  const snapshotFile = options.snapshotPath || path.join(options.rootDir, DEFAULT_SNAPSHOT_PATH);
  const snapshot = fs.existsSync(snapshotFile) ? loadSnapshot(snapshotFile) : null;

  const snapshotMissingForCode: VerifyResult['snapshotMissingForCode'] = [];
  const schemaOnlyWarnings: VerifyResult['schemaOnlyWarnings'] = [];
  const typeMismatches: VerifyResult['typeMismatches'] = [];

  if (snapshot) {
    for (const baseId of CONTENT_OS_BASE_IDS) {
      const base = SCHEMA_BASES[baseId];
      const snap = snapshot.bases[baseId];
      if (!snap) {
        snapshotMissingForCode.push({ base: baseId, name: '(entire base missing from snapshot)' });
        continue;
      }
      const snapByName = new Map(snap.properties.map(p => [p.name, normalizeSnapshotType(p.type)]));
      const schemaNames = new Set(Object.values(base.properties).map(p => p.name));
      for (const prop of Object.values(base.properties)) {
        const snapType = snapByName.get(prop.name);
        if (!snapType) {
          snapshotMissingForCode.push({ base: baseId, name: prop.name });
          continue;
        }
        if (snapType !== prop.type) {
          typeMismatches.push({
            base: baseId,
            name: prop.name,
            schemaType: prop.type,
            snapshotType: snapType,
          });
        }
      }
      for (const snapName of snapByName.keys()) {
        if (!schemaNames.has(snapName)) {
          schemaOnlyWarnings.push({ base: baseId, name: snapName });
        }
      }
    }
  }

  return {
    ok:
      undeclared.length === 0 &&
      typeMismatches.length === 0 &&
      snapshotMissingForCode.length === 0 &&
      schemaOnlyWarnings.length === 0,
    scanned,
    undeclared,
    snapshotPath: snapshot ? snapshotFile : null,
    snapshotMissingForCode,
    schemaOnlyWarnings,
    typeMismatches,
  };
}

export function formatVerifyReport(result: VerifyResult): string {
  const lines: string[] = [];
  lines.push(
    `schema:verify scanned ${result.scanned.length} property names; undeclared=${result.undeclared.length}`
  );
  if (result.snapshotPath) {
    lines.push(`snapshot: ${result.snapshotPath}`);
    lines.push(
      `snapshot missing-in-schema=${result.snapshotMissingForCode.length} extras-in-snapshot=${result.schemaOnlyWarnings.length} type mismatches=${result.typeMismatches.length}`
    );
  } else {
    lines.push('snapshot: none (code-vs-schema only)');
  }
  for (const u of result.undeclared) {
    lines.push(`UNDECLARED ${JSON.stringify(u.name)} @ ${u.files.slice(0, 5).join(', ')}`);
  }
  for (const m of result.typeMismatches) {
    lines.push(
      `TYPE ${m.base} ${JSON.stringify(m.name)} schema=${m.schemaType} snapshot=${m.snapshotType}`
    );
  }
  for (const m of result.snapshotMissingForCode) {
    lines.push(`SNAPSHOT-MISSING ${m.base} ${JSON.stringify(m.name)}`);
  }
  for (const w of result.schemaOnlyWarnings) {
    lines.push(`SNAPSHOT-EXTRA ${w.base} ${JSON.stringify(w.name)}`);
  }
  return lines.join('\n');
}
