import { checkRegistryHealthy, listDistributors } from './registry';

checkRegistryHealthy();
const live = listDistributors().filter(d => d.status === 'live').map(d => d.id);
console.log(`[capabilities] registry healthy; live=${live.join(',')}; total=${listDistributors().length}`);
