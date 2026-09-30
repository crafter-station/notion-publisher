import { postizIntegrations } from './postiz-integrations';

export type PostizCoverage = ReturnType<typeof postizCoverage>;
export function postizCoverage(
  accounts: { channel: string; connected: boolean }[] | null,
) {
  const known = new Set<string>(postizIntegrations.map((item) => item.id));
  const variants = postizIntegrations.map((item) => {
    const matches = accounts?.filter((account) => account.channel === item.id);
    const activeAccounts = matches?.filter((account) => account.connected).length ?? 0;
    return {
      id: item.id,
      name: item.name,
      channelId: item.channelId,
      activeAccounts,
      state: accounts === null
        ? 'unverified' as const
        : activeAccounts > 0
          ? 'active' as const
          : matches?.length
            ? 'reconnect' as const
            : 'missing' as const,
    };
  });
  return {
    basis: 'reference_catalog' as const,
    total: variants.length,
    active: variants.filter((item) => item.state === 'active').length,
    reconnect: variants.filter((item) => item.state === 'reconnect').length,
    missing: variants.filter((item) => item.state === 'missing').length,
    unverified: variants.filter((item) => item.state === 'unverified').length,
    unknownIdentifiers: [...new Set((accounts ?? []).map((item) => item.channel).filter((id) => !known.has(id)))],
    variants,
  };
}
