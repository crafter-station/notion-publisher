/**
 * Authoritative Notion schema for notion-publisher.
 *
 * Content OS names and types come from the live dumps v2 (Canales, Cuentas,
 * Piezas, Publicaciones, 🥇 My Templates). Publisher remains the legacy
 * single-DB contract used by existing extract* aliases.
 *
 * Database ids are defaults (overridable via env). No secrets.
 */

export type NotionPropType =
  | 'title'
  | 'rich_text'
  | 'status'
  | 'date'
  | 'created_time'
  | 'select'
  | 'multi_select'
  | 'url'
  | 'files'
  | 'checkbox'
  | 'relation'
  | 'number'
  | 'rollup'
  | 'formula'
  | 'button';

export type SchemaProperty = {
  key: string;
  name: string;
  type: NotionPropType;
  envKey: string;
  options?: string[];
  readOnly?: boolean;
};

export type SchemaBaseId =
  | 'publisher'
  | 'canales'
  | 'cuentas'
  | 'productos'
  | 'piezas'
  | 'publicaciones';

export type SchemaBase = {
  id: SchemaBaseId;
  emoji: string;
  displayName: string;
  databaseEnvKey: string;
  /** Default Notion database id (page id). Overridable via env. */
  defaultDatabaseId: string;
  dataSourceId?: string;
  properties: Record<string, SchemaProperty>;
};

function envPropKey(baseId: string, key: string): string {
  const snake = key.replace(/[A-Z]/g, m => `_${m}`).replace(/^_/, '').toUpperCase();
  return `NOTION_PROP_${baseId.toUpperCase()}_${snake}`;
}

function defineProps(
  baseId: string,
  entries: Array<
    [key: string, name: string, type: NotionPropType, extra?: { options?: string[]; readOnly?: boolean }]
  >
): Record<string, SchemaProperty> {
  const out: Record<string, SchemaProperty> = {};
  for (const [key, name, type, extra] of entries) {
    out[key] = {
      key,
      name,
      type,
      envKey: envPropKey(baseId, key),
      options: extra?.options,
      readOnly: extra?.readOnly,
    };
  }
  return out;
}

/** Legacy unified Publisher DB (existing extract* / alias webhooks). */
export const PUBLISHER_SCHEMA: SchemaBase = {
  id: 'publisher',
  emoji: '📰',
  displayName: 'Publisher',
  databaseEnvKey: 'NOTION_DATABASE_ID',
  defaultDatabaseId: '',
  properties: defineProps('publisher', [
    ['name', 'Name', 'title'],
    ['promptChainTemplateName', 'Prompt Chain Template Name', 'title'],
    ['status', 'Status', 'status'],
    ['brand', 'Brand', 'select'],
    ['date', 'Date', 'date'],
    ['created', 'Created', 'created_time'],
    ['select', 'Select', 'select'],
    ['caption', 'Caption', 'rich_text'],
    ['povText', 'POV Text', 'rich_text'],
    ['instagramCaption', 'Instagram Caption', 'rich_text'],
    ['facebookPost', 'Facebook Post', 'rich_text'],
    ['linkedinPost', 'LinkedIn Post', 'rich_text'],
    ['tiktokCaption', 'TikTok Caption', 'rich_text'],
    ['twitterPost', 'Twitter Post', 'rich_text'],
    ['pinterestTitle', 'Pinterest Title', 'rich_text'],
    ['pinterestDescription', 'Pinterest Description', 'rich_text'],
    ['youtubeTitle', 'YouTube Title', 'rich_text'],
    ['youtubeCaption', 'YouTube Caption', 'rich_text'],
    ['universalFirstComment', 'Universal First Comment', 'rich_text'],
    ['video', 'Video', 'files'],
    ['gif', 'GIF', 'files'],
    ['image', 'Image', 'files'],
    ['screenshot', 'Screenshot', 'files'],
    ['url', 'url', 'url'],
    ['sourceTags', 'Source Tags', 'multi_select'],
    ['layer', 'Layer', 'select'],
    ['template', 'Template', 'rich_text'],
    ['landingPageCopy', 'Landing Page Copy', 'rich_text'],
    ['gumroadTitle', 'Gumroad Title', 'rich_text'],
    ['gumroadCover', 'Gumroad Cover', 'files'],
    ['gumroadThumbnail', 'Gumroad Thumbnail', 'files'],
    ['cover', 'Cover', 'files'],
    ['icon', 'Icon', 'files'],
    ['gumroadProductId', 'Gumroad Product ID', 'rich_text'],
    ['gumroadUrl', 'Gumroad URL', 'url'],
    ['gumroadEditUrl', 'Gumroad Edit URL', 'url'],
    ['gumroadPublishStatus', 'Gumroad Publish Status', 'status'],
    ['postlyPublishStatus', 'Postly Publish Status', 'status'],
    ['postlyUrl', 'Postly URL', 'url'],
    ['postId', 'Post ID', 'rich_text'],
    ['lumaTitle', 'Luma Title', 'rich_text'],
    ['lumaName', 'Luma Name', 'rich_text'],
    ['lumaStart', 'Luma Start', 'date'],
    ['lumaEnd', 'Luma End', 'date'],
    ['lumaLocation', 'Luma Location', 'rich_text'],
    ['lumaDescription', 'Luma Description', 'rich_text'],
    ['lumaCover', 'Luma Cover', 'files'],
    ['lumaPublishStatus', 'Luma Publish Status', 'status'],
    ['lumaEventUrl', 'Luma Event URL', 'url'],
    ['githubRepo', 'GitHub Repo', 'rich_text'],
    ['githubOrg', 'GitHub Org', 'select'],
    ['githubAsset', 'GitHub Asset', 'files'],
    ['file', 'File', 'files'],
    ['releaseTag', 'Release Tag', 'rich_text'],
    ['releaseNotes', 'Release Notes', 'rich_text'],
    ['githubPublishStatus', 'GitHub Publish Status', 'status'],
    ['githubReleaseUrl', 'GitHub Release URL', 'url'],
    ['githubReleaseId', 'GitHub Release ID', 'rich_text'],
    ['redditTitle', 'Reddit Title', 'rich_text'],
    ['redditBody', 'Reddit Body', 'rich_text'],
    ['redditSubreddit', 'Reddit Subreddit', 'rich_text'],
    ['redditLinkUrl', 'Reddit Link URL', 'url'],
    ['redditUrl', 'Reddit URL', 'url'],
    ['channels', 'Channels', 'multi_select'],
    ['composioUserId', 'Composio User ID', 'rich_text'],
    ['composioConnectedAccountId', 'Composio Connected Account ID', 'rich_text'],
    ['composioPublishStatus', 'Composio Publish Status', 'status'],
    ['composioUrl', 'Composio URL', 'url'],
    ['eventbriteTitle', 'Eventbrite Title', 'rich_text'],
    ['eventbriteDescription', 'Eventbrite Description', 'rich_text'],
    ['eventbriteStart', 'Eventbrite Start', 'date'],
    ['eventbriteEnd', 'Eventbrite End', 'date'],
    ['eventbriteTimezone', 'Eventbrite Timezone', 'rich_text'],
    ['eventbriteCurrency', 'Eventbrite Currency', 'rich_text'],
    ['eventbriteOrganizationId', 'Eventbrite Organization ID', 'rich_text'],
    ['eventbriteVenueId', 'Eventbrite Venue ID', 'rich_text'],
    ['eventbriteOnline', 'Eventbrite Online', 'checkbox'],
    ['eventbriteConnectedAccountId', 'Eventbrite Connected Account ID', 'rich_text'],
    ['eventbriteUrl', 'Eventbrite URL', 'url'],
    ['postizTargets', 'Postiz Targets', 'multi_select'],
    ['postizDiscord', 'Postiz Discord', 'rich_text'],
    ['postizSlack', 'Postiz Slack', 'rich_text'],
    ['postizMastodon', 'Postiz Mastodon', 'rich_text'],
    ['postizSkool', 'Postiz Skool', 'rich_text'],
    ['postizTwitch', 'Postiz Twitch', 'rich_text'],
    ['postizKick', 'Postiz Kick', 'rich_text'],
    ['postizFarcaster', 'Postiz Farcaster', 'rich_text'],
    ['postizWarpcast', 'Postiz Warpcast', 'rich_text'],
    ['postizNostr', 'Postiz Nostr', 'rich_text'],
    ['postizLemmy', 'Postiz Lemmy', 'rich_text'],
    ['postizListmonk', 'Postiz Listmonk', 'rich_text'],
    ['postizDiscordChannel', 'Postiz Discord Channel', 'rich_text'],
    ['postizSlackChannel', 'Postiz Slack Channel', 'rich_text'],
    ['postizSkoolGroup', 'Postiz Skool Group', 'rich_text'],
    ['postizSkoolLabel', 'Postiz Skool Label', 'rich_text'],
    ['postizSkoolTitle', 'Postiz Skool Title', 'rich_text'],
    ['postizTwitchMessageType', 'Postiz Twitch Message Type', 'rich_text'],
    ['postizTwitchAnnouncementColor', 'Postiz Twitch Announcement Color', 'rich_text'],
    ['postizWarpcastChannels', 'Postiz Warpcast Channels', 'rich_text'],
    ['postizFarcasterChannels', 'Postiz Farcaster Channels', 'rich_text'],
    ['postizLemmyCommunity', 'Postiz Lemmy Community', 'rich_text'],
    ['postizLemmyCommunityId', 'Postiz Lemmy Community ID', 'rich_text'],
    ['postizLemmyTitle', 'Postiz Lemmy Title', 'rich_text'],
    ['postizLemmyUrl', 'Postiz Lemmy URL', 'url'],
    ['postizListmonkSubject', 'Postiz Listmonk Subject', 'rich_text'],
    ['postizListmonkPreview', 'Postiz Listmonk Preview', 'rich_text'],
    ['postizListmonkList', 'Postiz Listmonk List', 'rich_text'],
    ['postizListmonkTemplate', 'Postiz Listmonk Template', 'rich_text'],
    ['postizDiscordIntegrationId', 'Postiz Discord Integration ID', 'rich_text'],
    ['postizSlackIntegrationId', 'Postiz Slack Integration ID', 'rich_text'],
    ['postizMastodonIntegrationId', 'Postiz Mastodon Integration ID', 'rich_text'],
    ['postizSkoolIntegrationId', 'Postiz Skool Integration ID', 'rich_text'],
    ['postizTwitchIntegrationId', 'Postiz Twitch Integration ID', 'rich_text'],
    ['postizKickIntegrationId', 'Postiz Kick Integration ID', 'rich_text'],
    ['postizWarpcastIntegrationId', 'Postiz Warpcast Integration ID', 'rich_text'],
    ['postizNostrIntegrationId', 'Postiz Nostr Integration ID', 'rich_text'],
    ['postizLemmyIntegrationId', 'Postiz Lemmy Integration ID', 'rich_text'],
    ['postizListmonkIntegrationId', 'Postiz Listmonk Integration ID', 'rich_text'],
    ['postizSchedule', 'Postiz Schedule', 'date'],
    ['schedule', 'Schedule', 'date'],
    ['postizPublishStatus', 'Postiz Publish Status', 'status'],
    ['postizUrls', 'Postiz URLs', 'rich_text'],
    ['typefullyThread', 'Typefully Thread', 'rich_text'],
    ['typefullyMastodon', 'Typefully Mastodon', 'rich_text'],
    ['typefullyBluesky', 'Typefully Bluesky', 'rich_text'],
    ['typefullyAccount', 'Typefully Account', 'rich_text'],
    ['typefullySocialSetId', 'Typefully Social Set ID', 'rich_text'],
    ['typefullyTitle', 'Typefully Title', 'rich_text'],
    ['typefullySchedule', 'Typefully Schedule', 'date'],
    ['typefullyPublishStatus', 'Typefully Publish Status', 'status'],
    ['typefullyUrl', 'Typefully URL', 'url'],
    ['xPost', 'X Post', 'rich_text'],
    ['threadsPost', 'Threads Post', 'rich_text'],
    ['restreamTitle', 'Restream Title', 'rich_text'],
    ['restreamDescription', 'Restream Description', 'rich_text'],
    ['restreamStart', 'Restream Start', 'date'],
    ['restreamSchedule', 'Restream Schedule', 'date'],
    ['restreamStreamType', 'Restream Stream Type', 'select'],
    ['restreamFileId', 'Restream File ID', 'rich_text'],
    ['restreamPublishStatus', 'Restream Publish Status', 'status'],
    ['restreamUrl', 'Restream URL', 'url'],
    ['skoolPublishStatus', 'Skool Publish Status', 'status'],
    ['skoolPostUrl', 'Skool Post URL', 'url'],
    ['oncePublishStatus', 'ONCE Publish Status', 'status'],
    ['onceUrl', 'ONCE URL', 'url'],
  ]),
};

export const CANALES_SCHEMA: SchemaBase = {
  id: 'canales',
  emoji: '📡',
  displayName: 'Canales',
  databaseEnvKey: 'NOTION_CANALES_DATABASE_ID',
  defaultDatabaseId: '2d899274cb8a4efdb299c70dfa3184e9',
  dataSourceId: 'ac54e98d-760a-4332-83c9-44fbb552fec6',
  properties: defineProps('canales', [
    ['nombre', 'Nombre', 'title'],
    ['conector', 'Conector', 'select', { options: ['Postly', 'Postiz', 'Typefully', 'Composio', 'Nativo'] }],
    ['docs', 'Docs', 'url'],
    [
      'estadoDelConector',
      'Estado del conector',
      'select',
      { options: ['live', 'dry-run', 'stub', 'discover'] },
    ],
    [
      'familia',
      'Familia',
      'select',
      {
        options: [
          'Social',
          'Mensajería',
          'Blog',
          'Email',
          'Comunidad',
          'Eventos',
          'Productos',
          'Código',
          'Live',
        ],
      },
    ],
    ['limites', 'Límites', 'rich_text'],
    ['settingsRequeridos', 'Settings requeridos', 'rich_text'],
    ['verificadoEl', 'Verificado el', 'date'],
    [
      'estadoDelCanal',
      'Estado del canal',
      'select',
      { options: ['Activo', 'A3 pendiente', 'Descartado'] },
    ],
    ['score', 'Score ⭐', 'number'],
    ['piezas', '🧩 Piezas', 'relation'],
    ['cuentas', '🪪 Cuentas', 'relation'],
  ]),
};

export const CUENTAS_SCHEMA: SchemaBase = {
  id: 'cuentas',
  emoji: '🪪',
  displayName: 'Cuentas',
  databaseEnvKey: 'NOTION_CUENTAS_DATABASE_ID',
  defaultDatabaseId: '3d2b898f61d7481087452508051c60a4',
  dataSourceId: '56981bc9-71d3-4f54-af62-eb87cd049d1e',
  properties: defineProps('cuentas', [
    ['cuenta', 'Cuenta', 'title'],
    ['estado', 'Estado', 'select', { options: ['Activa', 'Pausada', 'Baja'] }],
    ['altaEl', 'Alta el', 'date'],
    ['conector', 'Conector', 'select', { options: ['Postly', 'Postiz', 'Typefully', 'Composio', 'Nativo'] }],
    ['handle', 'Handle', 'rich_text'],
    ['idDeIntegracion', 'ID de integración', 'rich_text'],
    ['marca', 'Marca', 'select', { options: ['nebulabs', 'gptchain'] }],
    ['canal', '📡 Canal', 'relation'],
    ['publicaciones', '🚀 Publicaciones', 'relation'],
  ]),
};

/** 🥇 My Templates — read-only product catalog. Never mutate its schema. */
export const PRODUCTOS_SCHEMA: SchemaBase = {
  id: 'productos',
  emoji: '🥇',
  displayName: '🥇 My Templates',
  databaseEnvKey: 'NOTION_PRODUCTOS_DATABASE_ID',
  defaultDatabaseId: 'c753239a6ce24175a3d198a3d24bbfe5',
  dataSourceId: 'd144b811-bb04-486b-99d5-89e6911ba71c',
  properties: defineProps('productos', [
    ['name', 'Name', 'title'],
    [
      'status',
      'Status',
      'status',
      { options: ['Not started', 'In progress', 'Completed', 'Pre-Published', 'Published'] },
    ],
    ['doDate', 'Do Date', 'date'],
    ['creativeType', 'Creative Type', 'select'],
    ['formats', 'Formats', 'relation', { readOnly: true }],
    ['listings', 'Listings', 'relation', { readOnly: true }],
    ['parent', 'Parent', 'relation', { readOnly: true }],
    ['pricing', 'Pricing', 'select', { options: ['Free', 'Free Options', 'Paid'] }],
    ['pricing1', 'Pricing 1', 'number'],
    ['pricing2', 'Pricing 2', 'number'],
    ['pricing3', 'Pricing 3', 'number'],
    ['pricing4', 'Pricing 4', 'number'],
    ['pricing1Half', '50% - Pricing 1', 'formula', { readOnly: true }],
    ['pricing2Half', '50% - Pricing 2', 'formula', { readOnly: true }],
    ['pricing3Half', '50% - Pricing 3', 'formula', { readOnly: true }],
    ['pricing4Half', '50% - Pricing 4', 'formula', { readOnly: true }],
    ['relatedAutomations', 'Related to Integrations & Automations (Templates)', 'relation', { readOnly: true }],
    ['relatedAutomations1', 'Related to Integrations & Automations (Templates) 1', 'relation', { readOnly: true }],
    ['repurpose', 'Repurpose', 'relation', { readOnly: true }],
    ['revenue', 'Revenue', 'number'],
    ['revenueIfGoalMet', 'Revenue if the goal is met', 'formula', { readOnly: true }],
    ['revenuePerSale', 'Revenue per sale', 'formula', { readOnly: true }],
    ['sales', 'Sales', 'number'],
    ['salesGoal', 'Sales Goal', 'number'],
    ['simplicity', 'Simplicity', 'select'],
    ['sources', 'Sources', 'relation', { readOnly: true }],
    ['tiendas', 'Tiendas', 'relation', { readOnly: true }],
    ['url', 'URL', 'url'],
    ['integrations', '⚙Integrations & Automations', 'relation', { readOnly: true }],
  ]),
};

export const PIEZAS_SCHEMA: SchemaBase = {
  id: 'piezas',
  emoji: '🧩',
  displayName: 'Piezas',
  databaseEnvKey: 'NOTION_PIEZAS_DATABASE_ID',
  defaultDatabaseId: '0733dfa0b7fa430d8a8fb4b97693ea17',
  dataSourceId: '3c631277-3d99-4a39-8ff1-d0a4503443b1',
  properties: defineProps('piezas', [
    ['nombre', 'Nombre', 'title'],
    ['status', 'Status', 'status', { options: ['Idea', 'Borrador', 'Lista', 'Programada', 'Publicada'] }],
    ['claveDeIdempotencia', 'Clave de idempotencia', 'rich_text'],
    ['captionBase', 'Caption base', 'rich_text'],
    ['fechaDePublicacion', 'Fecha de publicación', 'date'],
    ['file', 'File', 'files'],
    ['gif', 'GIF', 'files'],
    ['image', 'Image', 'files'],
    ['video', 'Video', 'files'],
    ['audio', 'Audio', 'files'],
    ['idiomaBase', 'Idioma base', 'select', { options: ['es', 'en', 'pt'] }],
    [
      'marca',
      'Marca',
      'select',
      {
        options: [
          'nebulabs',
          'gptchain',
          'TheVeller',
          'Núcleo',
          'Crafter',
          'Sundai',
          'hack0',
          'GPT-Chain',
          'Notion',
        ],
      },
    ],
    [
      'tipo',
      'Tipo',
      'select',
      { options: ['Social', 'Producto', 'Evento', 'Release', 'Música', 'Live', 'Email'] },
    ],
    ['modulo', 'Módulo', 'select', { options: ['Content', 'YT', 'Luma', 'Product Mockups'] }],
    [
      'formato',
      'Formato',
      'select',
      { options: ['post', 'carrusel', 'story', 'miniatura', 'cover de evento', 'video', 'reel'] },
    ],
    [
      'ratio',
      'Ratio',
      'select',
      {
        options: ['1:1', '4:5', '9:16', '16:9', 'YT 1280x720', 'Luma cover 1:1', 'Luma calendario 2:1'],
      },
    ],
    ['tamanoPx', 'Tamaño px', 'rich_text'],
    ['slides', 'Slides', 'number'],
    ['codigoDePlantilla', 'Código de plantilla', 'rich_text'],
    ['templateOrigenFuturaria', 'Template origen Futuraria', 'rich_text'],
    [
      'statusDeDiseno',
      'Status de diseño',
      'select',
      { options: ['Brief', 'Diseño', 'Listo para revisar', 'Aprobado'] },
    ],
    ['publicacionesPublicadas', 'Publicaciones (publicadas)', 'rollup', { readOnly: true }],
    ['publicacionesTotal', 'Publicaciones (total)', 'rollup', { readOnly: true }],
    ['publicadasTotal', 'Publicadas / total', 'formula', { readOnly: true }],
    ['canalesObjetivo', '📡 Canales objetivo', 'relation'],
    ['formatoDeVideo', '🎞️ Formato de video', 'relation'],
    ['publicaciones', '🚀 Publicaciones', 'relation'],
    ['producto', '🥇 Producto', 'relation'],
  ]),
};

export const PUBLICACIONES_SCHEMA: SchemaBase = {
  id: 'publicaciones',
  emoji: '🚀',
  displayName: 'Publicaciones',
  databaseEnvKey: 'NOTION_PUBLICACIONES_DATABASE_ID',
  defaultDatabaseId: '7ba3eb3574794182ab3628c4d708fca0',
  dataSourceId: '2a8f086d-8f50-45c4-adeb-4e0e90642ec4',
  properties: defineProps('publicaciones', [
    ['titulo', 'Título', 'title'],
    ['captionOverride', 'Caption override', 'rich_text'],
    ['claveDeIdempotencia', 'Clave de idempotencia', 'rich_text'],
    ['error', 'Error', 'rich_text'],
    ['idExterno', 'ID externo', 'rich_text'],
    ['idioma', 'Idioma', 'select', { options: ['es', 'en', 'pt'] }],
    ['modo', 'Modo', 'select', { options: ['dry-run', 'draft', 'live'] }],
    ['metricas', 'Métricas', 'number'],
    ['programarPara', 'Programar para', 'date'],
    ['publicadoEl', 'Publicado el', 'date'],
    ['settings', 'Settings', 'rich_text'],
    [
      'status',
      'Status',
      'status',
      { options: ['Pendiente', 'Dry-run OK', 'En cola', 'Fallido', 'Publicado'] },
    ],
    ['urlPublicada', 'URL publicada', 'url'],
    ['resultado', 'Resultado', 'rich_text'],
    ['imageVersion', 'Image (versión)', 'files'],
    ['pieza', '🧩 Pieza', 'relation'],
    ['cuenta', '🪪 Cuenta', 'relation'],
  ]),
};

export const SCHEMA_BASES: Record<SchemaBaseId, SchemaBase> = {
  publisher: PUBLISHER_SCHEMA,
  canales: CANALES_SCHEMA,
  cuentas: CUENTAS_SCHEMA,
  productos: PRODUCTOS_SCHEMA,
  piezas: PIEZAS_SCHEMA,
  publicaciones: PUBLICACIONES_SCHEMA,
};

export const CONTENT_OS_BASE_IDS = [
  'canales',
  'cuentas',
  'productos',
  'piezas',
  'publicaciones',
] as const;

export type ContentOsBaseId = (typeof CONTENT_OS_BASE_IDS)[number];

export const CONTENT_OS_PARENT_PAGE_ID_DEFAULT = '404da2435b4681eebbe6c73f68060bdd';
export const CONTENT_OS_PARENT_PAGE_ENV = 'NOTION_CONTENT_OS_PARENT_PAGE_ID';
/** Workspaces collection the Content OS page sits under. Not a database id. */
export const CONTENT_OS_WORKSPACES_DATA_SOURCE_ID = 'e28e7216-8dc3-4a77-a7ef-e81606bf39c8';
/** Related video-format catalog. Piezas may link it; not a publish base. */
export const CONTENT_OS_FORMATOS_VIDEO_DATABASE_ID = '70667ccdc2f84d8c975c7bd2c7291786';
export const CONTENT_OS_FORMATOS_VIDEO_DATA_SOURCE_ID = '29bad734-bc75-471b-805a-4da0b2a5df7d';

export const PIEZA_OPTIONAL_DESIGN_KEYS = [
  'modulo',
  'formato',
  'ratio',
  'tamanoPx',
  'slides',
  'codigoDePlantilla',
  'templateOrigenFuturaria',
  'statusDeDiseno',
] as const;

export const PUBLICACION_READY_STATUSES = ['Pendiente', 'Dry-run OK', 'En cola'] as const;
export const PUBLICACION_READY_STATUSES_ENV = 'NOTION_PUBLICACION_READY_STATUSES';

export const CONTENT_OS_PUBLISH_LIVE_ENV = 'CONTENT_OS_PUBLISH_LIVE';

export const SNAPSHOT_RELATIVE_PATH = 'schema/notion-snapshot.json';

export function listSchemaBases(): SchemaBase[] {
  return Object.values(SCHEMA_BASES);
}

export function listDeclaredPropertyNames(baseId?: SchemaBaseId): string[] {
  const bases = baseId ? [SCHEMA_BASES[baseId]] : listSchemaBases();
  const names = new Set<string>();
  for (const base of bases) {
    for (const prop of Object.values(base.properties)) names.add(prop.name);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function isDeclaredPropertyName(name: string, baseId?: SchemaBaseId): boolean {
  return listDeclaredPropertyNames(baseId).includes(name);
}

export const PUBLISHER_PROPERTY_NAMES: Record<string, string> = Object.fromEntries(
  Object.values(PUBLISHER_SCHEMA.properties).map(p => [p.key, p.name])
);
