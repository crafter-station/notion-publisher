// Read-only diagnosis of the OAuth connectors used by the local installation.
// Values of credentials never leave this process or appear in the report.
const { execFileSync } = require('node:child_process');
const definitions = [
  ['linkedin', ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET']],
  ['linkedin-page', ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET']],
  ['instagram', ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET']],
  ['instagram-standalone', ['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET']],
];
function diagnoseOAuth(env) {
  const base = env.FRONTEND_URL;
  let parsed;
  try { parsed = new URL(base); } catch { throw new Error('Postiz FRONTEND_URL is invalid'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('Postiz FRONTEND_URL is invalid');
  return definitions.map(([identifier, keys]) => {
    const missing = keys.filter(key => !env[key]?.trim() || ['undefined', 'null'].includes(env[key]));
    // Matches the installed Instagram Standalone provider's HTTP fallback.
    const externalRedirectRelay = identifier === 'instagram-standalone' && parsed.protocol === 'http:';
    const redirectUri = `${externalRedirectRelay ? 'https://redirectmeto.com/' : ''}${base}/integrations/social/${identifier}`;
    return { identifier, state: missing.length ? 'missing_app_credentials' : 'credentials_present_unverified', missing, redirectUri, externalRedirectRelay,
      remainingVerification: ['registered_callback', 'approved_scopes', 'account_authorization', 'token_lifecycle'] };
  });
}
function main() {
  let raw;
  try { raw = JSON.parse(execFileSync('docker', ['inspect', 'open-publisher-postiz', '--format', '{{json .Config.Env}}'], {encoding: 'utf8', timeout: 10000, stdio: ['ignore','pipe','pipe']})); }
  catch { throw new Error('Cannot inspect local Postiz environment'); }
  const env = Object.fromEntries(raw.map(line => { const at = line.indexOf('='); return [line.slice(0,at), line.slice(at+1)]; }));
  const channels = diagnoseOAuth(env);
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), scope: 'LinkedIn and Instagram variants only; not full 34-channel acceptance', channels }, null, 2));
  if (channels.some(channel => channel.missing.length)) process.exitCode = 1;
}
module.exports = { diagnoseOAuth };
if (require.main === module) { try { main(); } catch(error) { console.error(error.message); process.exitCode = 1; } }
