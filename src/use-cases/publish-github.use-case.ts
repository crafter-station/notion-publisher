import {
  GITHUB_PRODUCT_OWNER,
  GithubService,
} from '../services/github.service';
import {
  buildGithubProductReadme,
  buildGithubReleaseBody,
  extractGithubPublishContent,
  getNotionPage,
  updateGithubMetadata,
} from '../services/notion.service';

export type PublishGithubOptions = {
  /** Prefer true for first smoke. */
  draft?: boolean;
};

const PRODUCT_TOPICS = ['gpt-chain', 'gumroad', 'prompt-chain'];

/**
 * Seed TheVeller repo from Gumroad Notion fields, then create a Release + asset.
 */
export async function executePublishGithubUseCase(
  notion_page_id: string,
  options: PublishGithubOptions = {}
): Promise<void> {
  console.log(`[INFO] GitHub publish start (notionPageId: ${notion_page_id})`);
  await updateGithubMetadata(notion_page_id, { github_status: 'In progress' });

  try {
    const page = await getNotionPage(notion_page_id);
    const content = extractGithubPublishContent(page?.properties || {});

    if (!content.is_complete) {
      await updateGithubMetadata(notion_page_id, {
        github_status: 'Failed',
        final_status: 'Error',
      });
      console.error(
        `[ERROR] Incomplete GitHub content for ${notion_page_id}: ${content.missing.join('; ')}`
      );
      return;
    }

    if (content.owner !== GITHUB_PRODUCT_OWNER) {
      await updateGithubMetadata(notion_page_id, {
        github_status: 'Failed',
        final_status: 'Error',
      });
      console.error(
        `[ERROR] Product pipeline refuses owner ${content.owner}; must be ${GITHUB_PRODUCT_OWNER}`
      );
      return;
    }

    const gh = new GithubService();
    await gh.ensureRepo(content.owner, content.repo, {
      private: true,
      description: content.title,
    });

    await gh.updateRepo({
      owner: content.owner,
      repo: content.repo,
      description: content.title,
      homepage: content.gumroad_url || undefined,
      topics: PRODUCT_TOPICS,
    });

    let coverPath: string | undefined;
    let coverBytes: Buffer | undefined;
    let coverExt = 'png';
    if (content.cover_url) {
      try {
        const res = await fetch(content.cover_url);
        if (!res.ok) throw new Error(`cover fetch → ${res.status}`);
        coverBytes = Buffer.from(await res.arrayBuffer());
        const pathName = new URL(content.cover_url).pathname;
        const ext = pathName.split('.').pop()?.toLowerCase();
        if (ext && ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
          coverExt = ext === 'jpeg' ? 'jpg' : ext;
        }
        coverPath = `docs/cover.${coverExt}`;
        await gh.putFile({
          owner: content.owner,
          repo: content.repo,
          path: coverPath,
          content: coverBytes,
          message: 'chore: add product cover from Gumroad',
        });
        console.log(`[INFO] GitHub seeded ${coverPath}`);
      } catch (err: any) {
        console.warn(`[WARN] GitHub cover seed skipped: ${err.message}`);
        coverPath = undefined;
        coverBytes = undefined;
      }
    }

    const readme = buildGithubProductReadme({
      title: content.title,
      landing_page_md: content.landing_page_md,
      gumroad_url: content.gumroad_url,
      cover_path: coverPath,
    });
    await gh.putFile({
      owner: content.owner,
      repo: content.repo,
      path: 'README.md',
      content: readme,
      message: 'docs: seed product README from Landing Page Copy',
    });
    console.log('[INFO] GitHub seeded README.md');

    if (content.template_json) {
      await gh.putFile({
        owner: content.owner,
        repo: content.repo,
        path: 'template.json',
        content: content.template_json,
        message: 'chore: seed template.json from Notion Template',
      });
      console.log('[INFO] GitHub seeded template.json');
    }

    const releaseBody = buildGithubReleaseBody({
      release_notes: content.release_notes,
      landing_page_md: content.landing_page_md,
      gumroad_url: content.gumroad_url,
    });

    const release = await gh.createRelease({
      owner: content.owner,
      repo: content.repo,
      tag: content.tag,
      name: `${content.title} ${content.tag}`,
      body: releaseBody,
      draft: options.draft ?? false,
    });

    try {
      let bytes: Buffer;
      let fileName: string;
      let contentType = 'application/octet-stream';

      if (content.asset_url) {
        const res = await fetch(content.asset_url);
        if (!res.ok) throw new Error(`asset fetch → ${res.status}`);
        bytes = Buffer.from(await res.arrayBuffer());
        const urlPath = new URL(content.asset_url).pathname;
        fileName = urlPath.split('/').pop() || `${content.repo}-asset.bin`;
        contentType = res.headers.get('content-type') || contentType;
      } else {
        bytes = Buffer.from(content.template_json, 'utf8');
        fileName = 'template.json';
        contentType = 'application/json';
      }

      await gh.uploadReleaseAsset({
        owner: content.owner,
        repo: content.repo,
        releaseId: release.id,
        fileName,
        bytes,
        contentType,
      });
      console.log(`[INFO] GitHub asset uploaded ${fileName}`);

      if (coverBytes) {
        await gh.uploadReleaseAsset({
          owner: content.owner,
          repo: content.repo,
          releaseId: release.id,
          fileName: `cover.${coverExt}`,
          bytes: coverBytes,
          contentType: `image/${coverExt === 'jpg' ? 'jpeg' : coverExt}`,
        });
        console.log(`[INFO] GitHub asset uploaded cover.${coverExt}`);
      }
    } catch (err: any) {
      console.warn(`[WARN] GitHub asset upload failed (release exists): ${err.message}`);
    }

    await updateGithubMetadata(notion_page_id, {
      github_status: 'Published',
      release_url: release.html_url,
      release_id: String(release.id),
      github_repo: content.full_name,
      final_status: 'Published',
    });

    console.log(
      `[INFO] GitHub publish ok (notionPageId: ${notion_page_id}, release: ${release.html_url}, draft: ${release.draft})`
    );
  } catch (err: any) {
    console.error(`[ERROR] GitHub publish failed for ${notion_page_id}:`, err.message || err);
    await updateGithubMetadata(notion_page_id, {
      github_status: 'Failed',
      final_status: 'Error',
    }).catch((e: any) => console.warn('[WARN] GitHub failure writeback failed', e.message));
  }
}
