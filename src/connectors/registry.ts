import { ComposioEventbriteConnector, ComposioRedditConnector } from './composio.connector';
import { GithubConnector, GumroadConnector, LumaConnector, PostlyConnector } from './legacy.connectors';
import { PostizConnector } from './postiz.connector';
import { RestreamConnector } from './restream.connector';
import { TypefullyConnector } from './typefully.connector';
import { Connector, ConnectorId } from './types';

const LIST_IDS: ConnectorId[] = [
  'postiz',
  'typefully',
  'restream',
  'composio-reddit',
  'composio-eventbrite',
  'postly',
  'gumroad',
  'luma',
  'github',
];

const cache: Partial<Record<ConnectorId, Connector>> = {};

function createConnector(id: ConnectorId): Connector {
  switch (id) {
    case 'postiz':
      return new PostizConnector();
    case 'typefully':
      return new TypefullyConnector();
    case 'restream':
      return new RestreamConnector();
    case 'composio-reddit':
    case 'composio':
      return new ComposioRedditConnector();
    case 'composio-eventbrite':
      return new ComposioEventbriteConnector();
    case 'postly':
      return new PostlyConnector();
    case 'gumroad':
      return new GumroadConnector();
    case 'luma':
      return new LumaConnector();
    case 'github':
      return new GithubConnector();
    default:
      throw new Error(`Unknown connector: ${id}`);
  }
}

export function getConnector(id: ConnectorId): Connector {
  if (!cache[id]) cache[id] = createConnector(id);
  return cache[id]!;
}

export function listConnectors(): Connector[] {
  return LIST_IDS.map(getConnector);
}

export function resolveConnectorId(input: {
  canalNombre?: string;
  canalConector?: string;
  canalFamilia?: string;
  cuentaConector?: string;
  settings?: string;
}): ConnectorId {
  const blob = `${input.canalNombre || ''} ${input.settings || ''}`.toLowerCase();
  if (/restream/.test(blob)) return 'restream';
  if (/eventbrite/.test(blob)) return 'composio-eventbrite';
  if (/reddit/.test(blob)) return 'composio-reddit';
  if (/gumroad/.test(blob)) return 'gumroad';
  if (/github/.test(blob)) return 'github';
  if (/\bluma\b/.test(blob)) return 'luma';
  if (/postiz/.test(blob)) return 'postiz';
  if (/typefully/.test(blob)) return 'typefully';
  if (/postly/.test(blob)) return 'postly';

  const conector = input.cuentaConector || input.canalConector || '';
  if (conector === 'Postiz') return 'postiz';
  if (conector === 'Typefully') return 'typefully';
  if (conector === 'Postly') return 'postly';
  if (conector === 'Composio') {
    if (input.canalFamilia === 'Eventos') return 'composio-eventbrite';
    return 'composio-reddit';
  }
  if (conector === 'Nativo') {
    if (input.canalFamilia === 'Productos') return 'gumroad';
    if (input.canalFamilia === 'Código') return 'github';
    if (input.canalFamilia === 'Eventos') return 'luma';
    if (input.canalFamilia === 'Live') return 'restream';
  }
  throw new Error(
    `Cannot resolve connector from canal=${input.canalNombre || '?'} conector=${conector || '?'} familia=${input.canalFamilia || '?'}`
  );
}
