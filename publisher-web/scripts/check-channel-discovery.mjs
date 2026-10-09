import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const files = ['lib/server/private-media.ts', 'lib/postiz-integrations.ts', 'lib/channels.ts', 'lib/postiz-versions.ts', 'lib/thread-content.ts', 'lib/channel-settings.ts', 'app/api/v1/channels/route.ts'];
const source = (await Promise.all(files.map(file => readFile(new URL('../' + file, import.meta.url), 'utf8')))).join('\n').replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?/gm, '');
const harness = `let authenticated = false;
const context = async () => { if (!authenticated) throw new Error('unauthorized'); };
const respond = (value) => Response.json(value);
const handle = async (fn) => fn();
export function authenticate() { authenticated = true; }
`;
const js = ts.transpileModule(harness + source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { GET, authenticate, parseChannelSettings } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
await assert.rejects(GET(new Request('https://example.test')), /unauthorized/);
authenticate();
const body = await (await GET(new Request('https://example.test'))).json();
const fields = body.items.find(c => c.id === 'Reddit').authoring.channelSettings;
assert.equal(fields.length, 5);
for (const spec of fields) {
 const key = spec.field.replace('channelSettings.', '');
 assert.throws(() => parseChannelSettings({ [key]: 'a'.repeat(spec.maxCharacters + 1) }));
 if (spec.enum) for (const value of spec.enum) assert.doesNotThrow(() => parseChannelSettings({ [key]: value }));
}
assert(body.items.filter(c => c.id !== 'Reddit').every(c => c.authoring.channelSettings.length === 0));
assert(body.items.every(c => !c.authoring.media && !c.authoring.publishing));
console.log('Channel discovery passed: authentication invoked, supported fields discoverable, limits match draft validation, unsupported media/publication not advertised.');

assert.equal(body.privateMedia.partBytes, 10 * 1024 * 1024);
assert.equal(body.privateMedia.maxBytes, 5 * 1024 ** 3);
assert.equal(body.privateMedia.providerTransfer, false);
assert.equal(body.privateMedia.attachmentRequiresDraftRevision, true);
