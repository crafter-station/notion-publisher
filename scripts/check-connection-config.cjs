const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const directory = mkdtempSync(join(tmpdir(), 'publisher-config-'));
try {
  // A missing explicit file must fail even when the process has credentials.
  const result = spawnSync(process.execPath, [require.resolve('./check-connections.cjs'), join(directory, 'missing.env')], {
    encoding: 'utf8', timeout: 3000,
    env: { ...process.env, NOTION_TOKEN: 'private-test-value', NOTION_DATABASE_ID: 'private-test-id' },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 2);
  assert.deepEqual(JSON.parse(result.stdout), { state: 'configuration_file_not_found', scope: 'no provider requests made' });
  assert.equal(result.stderr, '');
  assert.ok(!result.stdout.includes(directory));
  assert.ok(!result.stdout.includes('private-test'));
  console.log('Connection configuration check passed: missing explicit file fails before provider checks, without exposing paths or credentials.');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
