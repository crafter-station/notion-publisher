import { env } from '../config/env';
import { buildPostizCreatePayload, PostizCreateInput, PostizService } from '../services/postiz.service';
import { Connector, ConnectorCapabilities, ConnectorValidation } from './types';

export class PostizConnector implements Connector<PostizCreateInput> {
  id = 'postiz' as const;
  constructor(private service = new PostizService()) {}

  validate(input: PostizCreateInput): ConnectorValidation {
    const { missing } = buildPostizCreatePayload(input);
    return { ok: missing.length === 0, missing };
  }

  publish(input: PostizCreateInput, options: { dryRun: boolean }) {
    return this.service.createPost(input, options);
  }

  capabilities(): ConnectorCapabilities {
    return {
      id: 'postiz',
      distributor: 'postiz',
      dryRunDefault: true,
      liveAllowed: env.POSTIZ_PUBLISH_LIVE === 'true',
      webhook: 'POST /webhooks/publish-postiz',
      notes: 'Dry-run default. Live needs POSTIZ_PUBLISH_LIVE=true. Prefer self-hosted.',
    };
  }
}
