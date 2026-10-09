// API inventory evidence only: no publication or refresh-token claims.
function summarizeCoverage(providers, accounts) {
  const identifiers = providers.map(p => p.identifier);
  if (!identifiers.length || identifiers.some(id => typeof id !== 'string' || !id.trim()) || new Set(identifiers).size !== identifiers.length) {
    throw new Error('Invalid registered integration inventory');
  }
  if (accounts !== null && (!Array.isArray(accounts) || accounts.some(a => !a || typeof a.id !== 'string' || !a.id.trim() || typeof a.identifier !== 'string' || !a.identifier.trim() || typeof a.disabled !== 'boolean'))) {
    throw new Error('Invalid API account inventory');
  }
  const channels = identifiers.map(identifier => {
    const matching = accounts?.filter(a => a.identifier === identifier) || [];
    const activeAccounts = matching.filter(a => !a.disabled).length;
    return { identifier, state: accounts === null ? 'not_verified' : activeAccounts ? 'active' : matching.length ? 'disabled' : 'missing', activeAccounts, disabledAccounts: matching.length - activeAccounts };
  });
  return {
    total: channels.length,
    active: channels.filter(c => c.state === 'active').length,
    disabled: channels.filter(c => c.state === 'disabled').length,
    missing: channels.filter(c => c.state === 'missing').length,
    unverified: channels.filter(c => c.state === 'not_verified').length,
    unregisteredIdentifiers: [...new Set((accounts || []).map(a => a.identifier).filter(id => !identifiers.includes(id)))],
    channels,
  };
}
module.exports = { summarizeCoverage };
