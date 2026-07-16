import { mkdir, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';

interface VisualAsset {
  label: string;
  url?: string;
}

export async function downloadGumroadVisuals(params: {
  title: string;
  slug?: string;
  assets: VisualAsset[];
}) {
  const folderName = [params.slug, slugify(params.title)].filter(Boolean).join('__');
  const outputDir = path.join(os.homedir(), 'Downloads', 'gumroad-visuals', folderName);
  await mkdir(outputDir, { recursive: true });

  const downloaded: string[] = [];

  for (const asset of params.assets) {
    if (!asset.url) continue;

    try {
      const response = await fetch(asset.url);
      if (!response.ok) {
        console.warn(`[VISUALS] Failed to download ${asset.label}: HTTP ${response.status}`);
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      const extension = extensionFromUrlOrContentType(asset.url, contentType);
      const filename = `${asset.label}.${extension}`;
      const filepath = path.join(outputDir, filename);
      await writeFile(filepath, Buffer.from(await response.arrayBuffer()));
      downloaded.push(filepath);
    } catch (error: any) {
      console.warn(`[VISUALS] Failed to download ${asset.label}: ${error.message}`);
    }
  }

  return {
    outputDir,
    downloaded,
  };
}

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 80) || 'untitled';
}

function extensionFromUrlOrContentType(url: string, contentType: string) {
  const pathname = safePathname(url);
  const ext = path.extname(pathname).replace('.', '').toLowerCase();
  if (ext && /^[a-z0-9]+$/.test(ext)) return ext;

  if (contentType.includes('png')) return 'png';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';

  return 'bin';
}

function safePathname(url: string) {
  try {
    return new URL(url).pathname;
  } catch {
    return '';
  }
}
