import { buildRestreamCreatePayload, RestreamCreateInput, RestreamService } from '../services/restream.service';
import { Connector, ConnectorCapabilities, ConnectorValidation } from './types';

export class RestreamConnector implements Connector<RestreamCreateInput> {
  id = 'restream' as const;
  constructor(private service = new RestreamService()) {}

  validate(input: RestreamCreateInput): ConnectorValidation {
    const { missing } = buildRestreamCreatePayload(input);
    return { ok: missing.length === 0, missing };
  }

  publish(input: RestreamCreateInput, _options: { dryRun: boolean }) {
    return this.service.createEvent(input, { dryRun: true });
  }

  capabilities(): ConnectorCapabilities {
    return {
      id: 'restream',
      distributor: 'restream',
      dryRunDefault: true,
      liveAllowed: false,
      webhook: 'POST /webhooks/publish-restream',
      notes: 'Create/schedule dry-run only. Never calls Restream. Never go-live.',
    };
  }
}
