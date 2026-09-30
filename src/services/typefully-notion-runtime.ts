import { ComposioService } from './composio.service';
import { createTypefullyDraftFromNotion } from '../use-cases/create-typefully-draft.use-case';

type Config = {
  notionToken: string;
  databaseId: string;
  composioApiKey: string;
  userId: string;
  connectedAccountId: string;
  journalDirectory: string;
};
/** Shared Node runtime for authenticated Notion webhook execution. No schedulers or boot imports. */
export function createTypefullyNotionRuntime(config: Config) {
  return async (pageId: string) => {
    if (Object.values(config).some(value => !value)) throw new Error('Typefully runtime configuration is incomplete');
    const service = new ComposioService(config.composioApiKey);
    const auth = await service.resolveTypefullyAccount(config.connectedAccountId, config.userId);
    const notion = async (id: string, properties?: Record<string, unknown>) => {
      const response = await fetch('https://api.notion.com/v1/pages/' + encodeURIComponent(id), {
        method: properties ? 'PATCH' : 'GET',
        headers: { Authorization: 'Bearer ' + config.notionToken, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
        body: properties && JSON.stringify({ properties }), redirect: 'error', signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error('Notion request failed: HTTP ' + response.status);
      return response.json();
    };
    return createTypefullyDraftFromNotion(pageId, {
      databaseId: config.databaseId,
      journalDirectory: config.journalDirectory,
      getPage: id => notion(id),
      updatePage: (id, properties) => notion(id, properties),
      createDraft: draft => service.createTypefullyDraft(draft, auth),
    });
  };
}
