import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STATIC_CUENTAS } from '../catalog/channels';
import { NotionTransport } from '../readers/notion-transport';
import { buildContentOsIngest, createContentOsIngest } from './to-cms-content-os';
import { ResolvedIngest } from './to-cms-ingest';

const resolved: ResolvedIngest = {
  title: 'New clip',
  layers: ['Social'],
  sources: ['Postly'],
  channels: ['Instagram'],
  pages: [{ layer: 'Social', sources: ['Postly'], channels: ['Instagram'], statusProps: [], title: 'New clip', fields: { Caption: 'hi' } }],
  missing: [],
  recommended: [],
  buttons: [],
  ok: true,
};

test('buildContentOsIngest creates one Publicacion per Cuenta with dry-run Modo', () => {
  const cuentas = STATIC_CUENTAS.filter(c => c.conector === 'Postly');
  const plan = buildContentOsIngest(resolved, cuentas);
  assert.equal(plan.pieza.properties.Nombre && true, true);
  assert.deepEqual((plan.pieza.properties.Status as any).status, { name: 'Lista' });
  assert.equal(plan.publicaciones.length, cuentas.length);
  for (const pub of plan.publicaciones) {
    assert.deepEqual((pub.properties.Modo as any).select, { name: 'dry-run' });
    assert.deepEqual((pub.properties.Status as any).status, { name: 'Pendiente' });
    assert.ok((pub.properties['Clave de idempotencia'] as any).rich_text[0].text.content.startsWith('tocms:'));
    assert.ok((pub.properties['🪪 Cuenta'] as any).relation[0].id);
  }
});

test('createContentOsIngest writes Pieza then links each Publicacion', async () => {
  const created: Array<{ db: string; props: Record<string, unknown> }> = [];
  const transport: NotionTransport = {
    async getPage(id) {
      return { id };
    },
    async queryAll() {
      return [];
    },
    async createPage(db, properties) {
      created.push({ db, props: properties });
      return { id: created.length === 1 ? 'pieza-new' : `pub-${created.length}` };
    },
    async updatePage() {},
  };
  const plan = buildContentOsIngest(resolved, STATIC_CUENTAS.slice(0, 2));
  const out = await createContentOsIngest(
    transport,
    { piezas: 'piezas', publicaciones: 'pubs' },
    plan
  );
  assert.equal(out.piezaId, 'pieza-new');
  assert.equal(out.publicacionIds.length, 2);
  assert.equal(created[0].db, 'piezas');
  assert.deepEqual((created[1].props['🧩 Pieza'] as any).relation, [{ id: 'pieza-new' }]);
});
