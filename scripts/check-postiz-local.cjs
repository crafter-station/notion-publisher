// Read-only local installation check. Never starts containers or publication workers.
const { execFileSync } = require('node:child_process');

async function main() {
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
    const response = await fetch('http://localhost:4007/api/public/v1/integrations', {
      headers: process.env.POSTIZ_API_KEY ? { Authorization: process.env.POSTIZ_API_KEY } : {},
      redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    report.api = { httpStatus: response.status, state: 'unexpected_response' };
    if (response.status === 401) report.api.state = process.env.POSTIZ_API_KEY ? 'credential_rejected' : 'authentication_required';
    else if (response.ok) {
      const accounts = await response.json();
      if (Array.isArray(accounts) && accounts.every(a => a && typeof a.id === 'string' && typeof a.identifier === 'string' && typeof a.disabled === 'boolean')) {
        report.api.state = 'read_verified';
        report.api.accounts = accounts.map(a => ({ id: a.id, channel: a.identifier, connected: !a.disabled }));
      }
    }
  } catch { /* Report availability only; exceptions may contain sensitive configuration. */ }
  console.log(JSON.stringify(report, null, 2));
  if (report.api.state !== 'read_verified') process.exitCode = 1;
}
main().catch(() => { console.error('Local Postiz check failed.'); process.exitCode = 1; });
