// Read-only local installation check. Never starts containers or publication workers.
const { execFileSync } = require('node:child_process');
const { summarizeCoverage } = require('./lib/postiz-coverage.cjs');
const inventory = require('../docs/postiz-channel-inventory.json');
const fs = require('node:fs');
const dotenv = require('dotenv');

async function main() {
  const index = process.argv.indexOf('--env');
  const file = index < 0 ? null : process.argv[index + 1];
  if (index >= 0 && (!file || file.startsWith('--'))) throw new Error('Missing environment file');
  const config = { ...(file ? dotenv.parse(fs.readFileSync(file)) : {}), ...process.env };
  const report = { checkedAt: new Date().toISOString(), project: 'open-publisher-postiz', containers: [], api: { state: 'unreachable' } };
  try {
    const output = execFileSync('docker', ['ps', '-a', '--filter', 'label=com.docker.compose.project=open-publisher-postiz', '--format', '{{json .}}'], { encoding: 'utf8', timeout: 15000 });
    report.containers = output.trim().split('\n').filter(Boolean).map(line => {
      const item = JSON.parse(line);
      return { name: item.Names, state: item.State, status: item.Status };
    });
  } catch {
    report.docker = 'unavailable';
  }
  try {
    report.imageMatchesInventory = execFileSync('docker', ['inspect', 'open-publisher-postiz', '--format', '{{.Image}}'], { encoding: 'utf8', timeout: 10000 }).trim() === inventory.imageId;
  } catch { report.imageMatchesInventory = false; }
  report.coverage = summarizeCoverage(inventory.providers, null);
  try {
    const response = await fetch('http://localhost:4007/api/public/v1/integrations', {
      headers: config.POSTIZ_API_KEY ? { Authorization: config.POSTIZ_API_KEY } : {},
      redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    report.api = { httpStatus: response.status, state: 'unexpected_response' };
    if (response.status === 401) report.api.state = config.POSTIZ_API_KEY ? 'credential_rejected' : 'authentication_required';
    else if (response.ok) {
      const accounts = await response.json();
      if (Array.isArray(accounts) && accounts.every(a => a && typeof a.id === 'string' && typeof a.identifier === 'string' && typeof a.disabled === 'boolean')) {
        report.coverage = summarizeCoverage(inventory.providers, accounts);
        report.api.state = 'read_verified';
        report.api.accounts = accounts.map(a => ({ id: a.id, channel: a.identifier, connected: !a.disabled }));
      }
    }
  } catch { /* Report availability only; exceptions may contain sensitive configuration. */ }
  report.allRegisteredIntegrationsActive = report.imageMatchesInventory && report.api.state === 'read_verified' && report.coverage.active === report.coverage.total && report.coverage.unregisteredIdentifiers.length === 0;
  report.acceptance = 'Active API accounts do not prove token renewal, publishing, or visibility from hosted Open Publisher.';
  console.log(JSON.stringify(report, null, 2));
  if (report.api.state !== 'read_verified' || !report.imageMatchesInventory || (process.argv.includes('--require-all-active') && !report.allRegisteredIntegrationsActive)) process.exitCode = 1;
}
main().catch(() => { console.error('Local Postiz check failed.'); process.exitCode = 1; });
