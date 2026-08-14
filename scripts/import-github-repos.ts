/**
 * Catalog import: list GitHub repos for an owner → Publisher metadata rows.
 * Idempotent on GitHub Repo rich_text == owner/repo.
 *
 * Usage:
 *   npm run github:import-repos -- --owner=TheVeller
 *   npm run github:import-repos -- --owner=Nucleo-Lab --limit=20
 */
import 'dotenv/config';
import {
  GITHUB_CATALOG_OWNERS,
  GithubService,
} from '../src/services/github.service';
import {
  createPublisherGithubCatalogPage,
  findPublisherPageByGithubRepo,
} from '../src/services/notion.service';

function arg(name: string, fallback = ''): string {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

async function main() {
  const owner = arg('owner', 'TheVeller');
  const limit = Number(arg('limit', '0')) || 0;

  if (!(GITHUB_CATALOG_OWNERS as readonly string[]).includes(owner)) {
    console.warn(
      `[import] owner ${owner} not in catalog allow-list ${GITHUB_CATALOG_OWNERS.join(', ')} — continuing anyway`
    );
  }

  const gh = new GithubService();
  let repos = await gh.listReposForOwner(owner);
  if (limit > 0) repos = repos.slice(0, limit);

  console.log(`[import] owner=${owner} repos=${repos.length}`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const r of repos) {
    const existing = await findPublisherPageByGithubRepo(r.full_name);
    if (existing) {
      console.log(`[import] skip ${r.full_name}`);
      skipped++;
      continue;
    }
    const result = await createPublisherGithubCatalogPage({
      full_name: r.full_name,
      html_url: r.html_url,
      description: r.description,
      owner: r.owner,
    });
    if (!result.success) {
      console.error(`[import] FAIL ${r.full_name}: ${result.error}`);
      failed++;
      continue;
    }
    console.log(`[import] created ${r.full_name} → ${result.page_id}`);
    created++;
  }

  console.log(`[import] done created=${created} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('[import] fatal', err);
  process.exit(1);
});
