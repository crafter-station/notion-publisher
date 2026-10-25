import { env } from '../config/env';
import {
  buildTypefullyDraftPayload,
  TypefullyDraftInput,
  TypefullyService,
} from '../services/typefully.service';
import { Connector, ConnectorCapabilities, ConnectorValidation } from './types';

export class TypefullyConnector implements Connector<TypefullyDraftInput> {
  id = 'typefully' as const;
  constructor(private service = new TypefullyService()) {}

  validate(input: TypefullyDraftInput): ConnectorValidation {
    const { missing } = buildTypefullyDraftPayload(input);
    return { ok: missing.length === 0, missing };
  }

  publish(input: TypefullyDraftInput, options: { dryRun: boolean }) {
    return this.service.createDraft(input, options);
  }

  capabilities(): ConnectorCapabilities {
    return {
      id: 'typefully',
      distributor: 'typefully',
      dryRunDefault: true,
      liveAllowed: env.TYPEFULLY_PUBLISH_LIVE === 'true',
      webhook: 'POST /webhooks/publish-typefully',
      notes: 'Dry-run default. Never sends publish_at. Live needs TYPEFULLY_PUBLISH_LIVE=true.',
    };
  }
}
