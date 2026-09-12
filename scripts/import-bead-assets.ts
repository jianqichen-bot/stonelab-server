import 'dotenv/config';

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import OSS from 'ali-oss';
import { fetchLegacyList } from './legacy-bead-api.js';

interface LegacyBead {
  bead_id: number;
  image: string;
  name: string;
}

interface ImportedAsset {
  contentType: string;
  etag?: string;
  objectKey: string;
  size: number;
  sourceUrl: string;
}

const manifestPath = resolve('var/imports/bead-assets.json');

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function fetchLegacyBeads(): Promise<LegacyBead[]> {
  return fetchLegacyList<LegacyBead>('list');
}

async function withRetries<T>(operation: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 500));
    }
  }
  throw new Error(`${label} failed after 3 attempts`, { cause: lastError });
}

function extensionFor(contentType: string, sourceUrl: string): string {
  const extensions: Record<string, string> = {
    'image/avif': 'avif',
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
  };
  const normalized = contentType.split(';', 1)[0]?.trim().toLowerCase() || '';
  if (extensions[normalized]) return extensions[normalized];
  const pathnameExtension = new URL(sourceUrl).pathname.match(/\.([a-zA-Z0-9]{2,5})$/)?.[1];
  return pathnameExtension?.toLowerCase() || 'bin';
}

async function downloadImage(sourceUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
  return withRetries(async () => {
    const response = await fetch(sourceUrl, { redirect: 'follow' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) throw new Error('empty response');
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    return { buffer, contentType };
  }, `Download ${sourceUrl}`);
}

async function mapConcurrent<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      const value = values[index];
      if (value !== undefined) results[index] = await mapper(value, index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()));
  return results;
}

async function main() {
  const bucket = requireEnvironment('OSS_BUCKET');
  const region = requireEnvironment('OSS_REGION');
  const endpoint = requireEnvironment('OSS_ENDPOINT');
  const client = new OSS({
    accessKeyId: requireEnvironment('OSS_ACCESS_KEY_ID'),
    accessKeySecret: requireEnvironment('OSS_ACCESS_KEY_SECRET'),
    bucket,
    endpoint,
    region,
    secure: true,
  });

  const beads = await fetchLegacyBeads();
  const sourceUrls = [...new Set(beads.map((bead) => bead.image.trim()).filter(Boolean))];
  const limitArgument = process.argv.find((argument) => argument.startsWith('--limit='));
  const parsedLimit = limitArgument
    ? Number(limitArgument.slice('--limit='.length))
    : sourceUrls.length;
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1)
    throw new Error('--limit must be a positive integer');
  const selectedUrls = sourceUrls.slice(0, parsedLimit);

  console.log(`Found ${beads.length} bead rows and ${sourceUrls.length} unique image URLs.`);
  console.log(`Importing ${selectedUrls.length} images into oss://${bucket}/beads/.`);

  const assets = await mapConcurrent(selectedUrls, 4, async (sourceUrl, index) => {
    const { buffer, contentType } = await downloadImage(sourceUrl);
    const digest = createHash('sha256').update(buffer).digest('hex');
    const objectKey = `beads/${digest}.${extensionFor(contentType, sourceUrl)}`;
    const result = await withRetries(
      () =>
        client.put(objectKey, buffer, {
          headers: {
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Content-Type': contentType,
          },
        }),
      `Upload ${objectKey}`,
    );
    console.log(`[${index + 1}/${selectedUrls.length}] ${objectKey} (${buffer.length} bytes)`);
    return {
      contentType,
      etag: (result.res.headers as Record<string, string>).etag,
      objectKey,
      size: buffer.length,
      sourceUrl,
    } satisfies ImportedAsset;
  });

  const manifest = {
    bucket,
    importedAt: new Date().toISOString(),
    region,
    sourceRows: beads.length,
    totalUniqueSourceUrls: sourceUrls.length,
    importedAssets: assets.length,
    assets,
  };
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Wrote migration manifest to ${manifestPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
