import { env } from '../config/env';
import {
  buildEventbriteExecuteBody,
  buildRedditExecuteBody,
  ComposioService,
  EventbriteCreateEventArgs,
  RedditCreatePostArgs,
} from '../services/composio.service';
import { Connector, ConnectorCapabilities, ConnectorValidation } from './types';

export type ComposioRedditInput = RedditCreatePostArgs & {
  userId: string;
  connectedAccountId?: string;
};

export type ComposioEventbriteInput = EventbriteCreateEventArgs & {
  userId: string;
  connectedAccountId?: string;
};

export class ComposioRedditConnector implements Connector<ComposioRedditInput> {
  id = 'composio-reddit' as const;
  constructor(private service?: ComposioService) {}

  private svc() {
    return this.service || (this.service = new ComposioService());
  }

  validate(input: ComposioRedditInput): ConnectorValidation {
    const { missing } = buildRedditExecuteBody(input, {
      userId: input.userId,
      connectedAccountId: input.connectedAccountId,
    });
    return { ok: missing.length === 0, missing };
  }

  publish(input: ComposioRedditInput, options: { dryRun: boolean }) {
    return this.svc().createRedditPost(
      input,
      { userId: input.userId, connectedAccountId: input.connectedAccountId },
      options
    );
  }

  capabilities(): ConnectorCapabilities {
    return {
      id: 'composio-reddit',
      distributor: 'composio',
      dryRunDefault: true,
      liveAllowed: env.COMPOSIO_PUBLISH_LIVE === 'true',
      webhook: 'POST /webhooks/publish-composio',
      notes: 'Reddit via REDDIT_CREATE_REDDIT_POST. Dry-run default.',
    };
  }
}

export class ComposioEventbriteConnector implements Connector<ComposioEventbriteInput> {
  id = 'composio-eventbrite' as const;
  constructor(private service?: ComposioService) {}

  private svc() {
    return this.service || (this.service = new ComposioService());
  }

  validate(input: ComposioEventbriteInput): ConnectorValidation {
    const { missing } = buildEventbriteExecuteBody(input, {
      userId: input.userId,
      connectedAccountId: input.connectedAccountId,
    });
    return { ok: missing.length === 0, missing };
  }

  publish(input: ComposioEventbriteInput, options: { dryRun: boolean }) {
    return this.svc().createEventbriteEvent(
      input,
      { userId: input.userId, connectedAccountId: input.connectedAccountId },
      options
    );
  }

  capabilities(): ConnectorCapabilities {
    return {
      id: 'composio-eventbrite',
      distributor: 'composio',
      dryRunDefault: true,
      liveAllowed: env.COMPOSIO_PUBLISH_LIVE === 'true',
      webhook: 'POST /webhooks/publish-composio',
      notes: 'Eventbrite via EVENTBRITE_CREATE_EVENT. Dry-run default.',
    };
  }
}
