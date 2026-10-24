/**
 * Shared publish-mode helper. Dry-run is the default: build + validate the
 * exact outbound payload without calling a create/publish endpoint.
 */

export type PublishModeOptions = {
  /** Default true. Set false only together with an explicit *_PUBLISH_LIVE env flag. */
  dryRun?: boolean;
};

export function isDryRun(options: PublishModeOptions = {}): boolean {
  return options.dryRun !== false;
}

export function livePublishAllowed(envFlag: string | undefined): boolean {
  return envFlag === 'true';
}

export type ConnectorDryRunResult<TPayload> = {
  dry_run: true;
  called_publish: false;
  payload: TPayload;
};

export type ConnectorLiveResult<TPayload, TResponse> = {
  dry_run: false;
  called_publish: true;
  payload: TPayload;
  response: TResponse;
};

export type ConnectorResult<TPayload, TResponse = unknown> =
  | ConnectorDryRunResult<TPayload>
  | ConnectorLiveResult<TPayload, TResponse>;
