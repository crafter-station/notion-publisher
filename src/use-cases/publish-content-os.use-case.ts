/**
 * POST /webhooks/publish — Pieza in, ready Publicaciones out, routed by
 * the Connector of each Cuenta. Dry-run unless the live gate opens.
 */

import { contentOsDatabaseIds } from '../config/content-os';
import { propertyName } from '../config/content-os';
import { env } from '../config/env';
import { logLiveGate, resolveLiveGate } from '../connectors/live-gate';
import { getConnector, resolveConnectorId } from '../connectors/registry';
import { ConnectorId } from '../connectors/types';
import {
  ContentOsReader,
  CuentaRecord,
  CanalRecord,
  mergedPublishProperties,
  PiezaRecord,
  PublicacionRecord,
} from '../readers/content-os.reader';
import { NotionTransport } from '../readers/notion-transport';
import {
  extractComposioEventbriteContent,
  extractComposioRedditContent,
  extractPostizContent,
  extractRestreamContent,
  extractTypefullyContent,
} from '../services/notion.service';
import { getPostizChannel } from '../services/postiz-channels.catalog';
import { resolvePostizIntegrations } from '../services/postiz.service';
import { parseTypefullySocialSetId } from '../services/typefully.service';

export type PublishContentOsResult = {
  pieza_id: string;
  dry_run_default: true;
  results: Array<{
    publicacion_id: string;
    connector: string;
    dry_run: boolean;
    reason: string;
    skipped?: string;
    error?: string;
    payload?: unknown;
  }>;
};

function settingsJson(raw: string): Record<string, any> {
  try {
    const v = JSON.parse(raw || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

async function writePublicacion(
  transport: NotionTransport,
  pubId: string,
  patch: {
    status?: string;
    error?: string;
    url?: string;
    publicadoEl?: string;
    idExterno?: string;
  }
) {
  const properties: Record<string, unknown> = {};
  if (patch.status) {
    properties[propertyName('publicaciones', 'status')] = { status: { name: patch.status } };
  }
  if (patch.error !== undefined) {
    properties[propertyName('publicaciones', 'error')] = {
      rich_text: [{ text: { content: patch.error.slice(0, 1900) } }],
    };
  }
  if (patch.url) {
    properties[propertyName('publicaciones', 'urlPublicada')] = { url: patch.url };
  }
  if (patch.publicadoEl) {
    properties[propertyName('publicaciones', 'publicadoEl')] = { date: { start: patch.publicadoEl } };
  }
  if (patch.idExterno) {
    properties[propertyName('publicaciones', 'idExterno')] = {
      rich_text: [{ text: { content: patch.idExterno.slice(0, 1900) } }],
    };
  }
  if (Object.keys(properties).length) await transport.updatePage(pubId, properties);
}

async function runConnector(
  connectorId: ConnectorId,
  props: Record<string, any>,
  cuenta: CuentaRecord,
  dryRun: boolean
) {
  const connector = getConnector(connectorId);
  switch (connectorId) {
    case 'postiz': {
      const content = extractPostizContent(props);
      const envIntegrations = Object.fromEntries(
        resolvePostizIntegrations().map(i => [i.identifier, i.id])
      );
      const targets = content.targets
        .map(t => getPostizChannel(t)?.identifier)
        .filter((id): id is string => !!id);
      const channels = (targets.length ? targets : resolvePostizIntegrations().map(i => i.identifier)).map(
        identifier => ({
          identifier,
          integration_id:
            content.integration_ids[identifier] ||
            cuenta.integrationId ||
            envIntegrations[identifier] ||
            '',
          content: content.overrides[identifier] || content.caption,
          settings: content.settings[identifier] || {},
        })
      );
      const input = {
        type: content.schedule_at ? 'schedule' as const : 'draft' as const,
        date: content.schedule_at || undefined,
        channels,
      };
      const v = connector.validate(input);
      if (!v.ok) throw new Error(v.missing.join('; '));
      return connector.publish(input, { dryRun });
    }
    case 'typefully': {
      const content = extractTypefullyContent(props);
      const input = {
        social_set_id: parseTypefullySocialSetId(content.social_set_id || cuenta.integrationId),
        draft_title: content.draft_title,
        plan_at: content.plan_at || undefined,
        platforms: content.platforms,
      };
      const v = connector.validate(input);
      if (!v.ok) throw new Error(v.missing.join('; '));
      return connector.publish(input, { dryRun });
    }
    case 'restream': {
      const content = extractRestreamContent(props);
      const input = {
        title: content.title,
        description: content.description || undefined,
        scheduledFor: content.scheduled_for || undefined,
        streamType: content.stream_type,
        fileId: content.file_id || undefined,
      };
      const v = connector.validate(input);
      if (!v.ok) throw new Error(v.missing.join('; '));
      return connector.publish(input, { dryRun: true });
    }
    case 'composio':
    case 'composio-reddit': {
      const reddit = extractComposioRedditContent(props);
      const settings = settingsJson(props.Settings?.rich_text?.[0]?.plain_text || '');
      const input = {
        subreddit: reddit.subreddit || settings.subreddit || env.COMPOSIO_REDDIT_SUBREDDIT,
        title: reddit.title || props.Name?.title?.[0]?.plain_text || '',
        kind: reddit.kind,
        text: reddit.body,
        url: reddit.link_url,
        userId: reddit.composio_user_id || env.COMPOSIO_USER_ID,
        connectedAccountId: reddit.composio_connected_account_id || env.COMPOSIO_CONNECTED_ACCOUNT_ID,
      };
      const v = connector.validate(input);
      if (!v.ok) throw new Error(v.missing.join('; '));
      return connector.publish(input, { dryRun });
    }
    case 'composio-eventbrite': {
      const eventbrite = extractComposioEventbriteContent(props);
      const input = {
        organization_id: eventbrite.organization_id,
        name: eventbrite.name,
        start_utc: eventbrite.start_raw,
        end_utc: eventbrite.end_raw,
        timezone: eventbrite.timezone,
        currency: eventbrite.currency,
        description_html: eventbrite.description_html,
        online_event: eventbrite.online_event,
        venue_id: eventbrite.venue_id || undefined,
        userId: eventbrite.composio_user_id || env.COMPOSIO_USER_ID,
        connectedAccountId:
          eventbrite.composio_connected_account_id || env.COMPOSIO_EVENTBRITE_CONNECTED_ACCOUNT_ID,
      };
      const v = connector.validate(input);
      if (!v.ok) throw new Error(v.missing.join('; '));
      return connector.publish(input, { dryRun });
    }
    default: {
      const v = connector.validate({ properties: props });
      if (!v.ok) throw new Error(v.missing.join('; '));
      return connector.publish({ properties: props }, { dryRun });
    }
  }
}

export type PublishImpl = (
  connectorId: ConnectorId,
  props: Record<string, any>,
  cuenta: CuentaRecord,
  dryRun: boolean
) => Promise<{ dry_run: boolean; payload?: unknown; response?: any }>;

export async function executePublishContentOsUseCase(
  piezaId: string,
  deps: { transport: NotionTransport; reader?: ContentOsReader; publishImpl?: PublishImpl }
): Promise<PublishContentOsResult> {
  const ids = contentOsDatabaseIds();
  const reader = deps.reader || new ContentOsReader(deps.transport, ids);
  const pieza: PiezaRecord = await reader.getPieza(piezaId);
  const pubs = await reader.listReadyPublicaciones(piezaId);
  const results: PublishContentOsResult['results'] = [];

  console.log(`[INFO] Content OS publish pieza=${piezaId} ready=${pubs.length} title=${pieza.nombre}`);

  for (const pub of pubs) {
    if (pub.publicadoEl || pub.status === 'Publicado') {
      results.push({
        publicacion_id: pub.id,
        connector: '',
        dry_run: true,
        reason: 'already_published',
        skipped: 'Publicado el already set',
      });
      continue;
    }
    if (pub.claveDeIdempotencia) {
      const existing = await reader.findByIdempotencyKey(pub.claveDeIdempotencia);
      if (existing && existing.id !== pub.id && (existing.publicadoEl || existing.status === 'Publicado')) {
        results.push({
          publicacion_id: pub.id,
          connector: '',
          dry_run: true,
          reason: 'idempotent_skip',
          skipped: `Clave de idempotencia already published on ${existing.id}`,
        });
        continue;
      }
    }

    const cuentaId = pub.cuentaIds[0];
    if (!cuentaId) {
      results.push({
        publicacion_id: pub.id,
        connector: '',
        dry_run: true,
        reason: 'missing_cuenta',
        error: 'Publicacion has no 🪪 Cuenta',
      });
      continue;
    }

    let cuenta: CuentaRecord;
    let canal: CanalRecord | undefined;
    try {
      cuenta = await reader.getCuenta(cuentaId);
      if (cuenta.canalIds[0]) canal = await reader.getCanal(cuenta.canalIds[0]);
    } catch (err: any) {
      results.push({
        publicacion_id: pub.id,
        connector: '',
        dry_run: true,
        reason: 'graph_error',
        error: err.message,
      });
      continue;
    }

    if (cuenta.estado !== 'Activa') {
      results.push({
        publicacion_id: pub.id,
        connector: cuenta.conector,
        dry_run: true,
        reason: `cuenta_${cuenta.estado || 'empty'}`,
        skipped: 'Only Activa cuentas can publish',
      });
      continue;
    }

    let connectorId: ConnectorId;
    try {
      connectorId = resolveConnectorId({
        canalNombre: canal?.nombre,
        canalConector: canal?.conector || cuenta.conector,
        canalFamilia: canal?.familia,
        cuentaConector: cuenta.conector,
        settings: pub.settings,
      });
    } catch (err: any) {
      results.push({
        publicacion_id: pub.id,
        connector: cuenta.conector,
        dry_run: true,
        reason: 'unresolved_connector',
        error: err.message,
      });
      continue;
    }

    const decision = resolveLiveGate({
      cuentaEstado: cuenta.estado,
      publicacionModo: pub.modo,
      canalEstadoDelConector: canal?.estadoDelConector,
    });
    logLiveGate(decision, {
      publicationId: pub.id,
      cuentaId: cuenta.id,
      canalId: canal?.id,
      connector: connectorId,
    });

    const props = mergedPublishProperties(pieza, pub);
    try {
      const publish = deps.publishImpl || runConnector;
      const result = await publish(connectorId, props, cuenta, decision.dryRun);
      if (result.dry_run) {
        await writePublicacion(deps.transport, pub.id, { status: 'Dry-run OK', error: '' });
        results.push({
          publicacion_id: pub.id,
          connector: connectorId,
          dry_run: true,
          reason: decision.reason,
          payload: result.payload,
        });
      } else {
        const url =
          (result as any).response?.url ||
          (result as any).response?.html_url ||
          (result as any).response?.private_url ||
          '';
        await writePublicacion(deps.transport, pub.id, {
          status: 'Publicado',
          publicadoEl: new Date().toISOString(),
          url: url || undefined,
          error: '',
        });
        results.push({
          publicacion_id: pub.id,
          connector: connectorId,
          dry_run: false,
          reason: decision.reason,
          payload: result.payload,
        });
      }
    } catch (err: any) {
      await writePublicacion(deps.transport, pub.id, { status: 'Fallido', error: err.message });
      results.push({
        publicacion_id: pub.id,
        connector: connectorId,
        dry_run: decision.dryRun,
        reason: decision.reason,
        error: err.message,
      });
    }
  }

  return { pieza_id: piezaId, dry_run_default: true, results };
}
