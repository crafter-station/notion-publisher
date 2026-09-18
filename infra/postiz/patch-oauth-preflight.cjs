const fs = require('node:fs');
const { createHash } = require('node:crypto');
const files = [
  ['/app/apps/backend/src/api/routes/integrations.controller.ts', 'b3db9a679231999ef008392f7c406016074831f95dfb5ef2a98cd44c9bad5ab2', 'controller'],
  ['/app/apps/backend/dist/apps/backend/src/api/routes/integrations.controller.js', 'bb5fb55366b283393fca3af438291711657c8629f738218dde61fb6c89ab038d', 'controller'],
  ['/app/apps/frontend/src/components/launches/add.provider.component.tsx', '01a9067d2ff67f15e9a1a93010c0c1e515eaa137b32fcfb25ed709812c58cb4d', 'source'],
  ['/app/apps/frontend/.next/static/chunks/0irk~psyjct7f.js', 'bb4c41c900a9630944745def1633f38fe81d2b151e655c3390b22fb1361bf30f', 'chunk'],
  ['/app/apps/frontend/.next/static/chunks/0jgp694k2b-.0.js', '5fff51943cfa2197ef6d94bacdca0dd28092df51f3cd855e86c522906f58be40', 'chunk'],
];
const preflight = `
    // Open Publisher: fail before creating OAuth state or a malformed redirect.
    const oauthAppKeys = new Map([
      ['linkedin', ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET']],
      ['linkedin-page', ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET']],
      ['instagram', ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET']],
      ['instagram-standalone', ['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET']],
    ]);
    const missingAppKeys = (oauthAppKeys.get(integration) || []).filter(key =>
      !process.env[key]?.trim() || ['undefined', 'null'].includes(process.env[key].trim())
    );
    if (missingAppKeys.length) {
      return { err: { code: 'oauth_app_not_configured', missing: missingAppKeys,
        message: 'Falta configurar la aplicación OAuth de ' + integration + ' en este Postiz. Variables: ' + missingAppKeys.join(', ') + '. Solicita la configuración al administrador.' } };
    }
`;
const changes = files.map(([file, expected, kind]) => {
  let source = fs.readFileSync(file, 'utf8');
  if (createHash('sha256').update(source).digest('hex') !== expected) throw new Error(`Review changed upstream file: ${file}`);
  if (kind === 'controller') {
    const start = source.indexOf('async getIntegrationUrl(');
    const provider = source.indexOf('const integrationProvider =', start);
    if (start < 0 || provider < 0) throw new Error('OAuth controller boundaries missing');
    source = source.slice(0, provider) + preflight + '\n    ' + source.slice(provider);
  } else if (kind === 'source') {
    const target = "t(\n                'could_not_connect_to_platform',\n                'Could not connect to the platform'\n              )";
    if (source.split(target).length !== 2) throw new Error('Frontend source error boundary changed');
    source = source.replace(target, `(typeof err === 'object' && typeof err.message === 'string' ? err.message : ${target})`);
  } else {
    const pattern = /([jC])\("could_not_connect_to_platform","Could not connect to the platform"\)/g;
    if ([...source.matchAll(pattern)].length !== 1) throw new Error('Frontend chunk error boundary changed');
    source = source.replace(pattern, original => `(typeof o==="object"&&typeof o.message==="string"?o.message:${original})`);
  }
  source = source.replace(/^\/\/# sourceMappingURL=.*$/m, '');
  return [file, source];
});
for (const [file, source] of changes) fs.writeFileSync(file, source);
console.log('LinkedIn/Instagram OAuth preflight and actionable connection messages applied.');
