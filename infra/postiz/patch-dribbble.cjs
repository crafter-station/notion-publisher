const fs = require('node:fs');
const { createHash } = require('node:crypto');
const suffix = 'libraries/nestjs-libraries/src/integrations/social/dribbble.provider';
const files = [
  [`/app/${suffix}.ts`, '23f78f394cbda9d8845b4fddce4cfeec8a21d614870ac579721fe0ef6f9c9f06'],
  ...['backend', 'orchestrator'].map(app => [`/app/apps/${app}/dist/${suffix}.js`, 'aef516f3a52ec41240315e64e660635e70164a4fb864b3783105d38b680a5358']),
];

// Refuse a changed upstream implementation rather than patching it heuristically.
const changes = files.map(([file, expected]) => {
  const source = fs.readFileSync(file, 'utf8');
  if (createHash('sha256').update(source).digest('hex') !== expected) throw new Error(`Review changed upstream file: ${file}`);
  const ts = file.endsWith('.ts');
  const start = source.indexOf('  async refreshToken(');
  const end = source.indexOf(ts ? '  @Tool(' : '    async teams(', start);
  if (start < 0 || end < 0) throw new Error('Dribbble method boundaries missing');
  const signature = ts ? 'refreshToken(_refreshToken: string): Promise<AuthTokenDetails>' : 'refreshToken(_refreshToken)';
  const replacement = `  async ${signature} {\n    // Dribbble documents code exchange only. The caller marks this account for reconnection.\n    throw new Error('Dribbble requires OAuth reconnection; token refresh is not supported.');\n  }\n\n`;
  const patched = (source.slice(0, start) + replacement + source.slice(end)).replace(/^\/\/# sourceMappingURL=.*$/m, '');
  if (/pinterest/i.test(patched)) throw new Error('Unexpected Pinterest reference remains in Dribbble');
  return [file, patched];
});
for (const [file, source] of changes) fs.writeFileSync(file, source);
console.log('Dribbble reconnect fix applied to source, backend and orchestrator.');
