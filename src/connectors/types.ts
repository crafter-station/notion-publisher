import { ConnectorResult } from './dry-run';

export type ConnectorId =
  | 'postiz'
  | 'typefully'
  | 'composio'
  | 'composio-reddit'
  | 'composio-eventbrite'
  | 'restream'
  | 'postly'
  | 'gumroad'
  | 'luma'
  | 'github';

export type ConnectorValidation = {
  ok: boolean;
  missing: string[];
};

export type ConnectorCapabilities = {
  id: ConnectorId;
  distributor: string;
  dryRunDefault: boolean;
  liveAllowed: boolean;
  webhook: string;
  notes: string;
};

export type PublishOptions = {
  /** Default true. Live requires the Content OS live gate + connector flag. */
  dryRun?: boolean;
};

export interface Connector<TInput = unknown, TPayload = unknown> {
  id: ConnectorId;
  validate(input: TInput): ConnectorValidation;
  publish(input: TInput, options: { dryRun: boolean }): Promise<ConnectorResult<TPayload>>;
  capabilities(): ConnectorCapabilities;
}
