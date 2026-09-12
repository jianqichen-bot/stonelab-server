import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import OSS from 'ali-oss';

const prefix = 'beads/';
const imagePattern = /\.(?:avif|gif|jpe?g|png|webp)$/i;

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function argumentValue(name: string): string | undefined {
  return process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function parseMinimumAgeHours(): number {
  const value = Number(argumentValue('min-age-hours') ?? '24');
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('--min-age-hours must be a non-negative number');
  }
  return value;
}

function normalizeObjectKey(value: string): string {
  return value.trim().replace(/^\/+/, '');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function listAllObjects(client: OSS): Promise<OSS.ObjectMeta[]> {
  const objects: OSS.ObjectMeta[] = [];
  let continuationToken: string | undefined;
  do {
    const result = await client.listV2(
      {
        prefix,
        'max-keys': 1000,
        ...(continuationToken ? { 'continuation-token': continuationToken } : {}),
      },
      {},
    );
    objects.push(...(result.objects ?? []));
    continuationToken = result.isTruncated ? result.nextContinuationToken : undefined;
  } while (continuationToken);
  return objects;
}

async function deleteConcurrently(client: OSS, keys: string[]): Promise<void> {
  let cursor = 0;
  const failures: { error: unknown; key: string }[] = [];

  async function worker() {
    while (cursor < keys.length) {
      const key = keys[cursor];
      cursor += 1;
      if (!key) continue;
      try {
        await client.delete(key);
        console.log(`Deleted ${key}`);
      } catch (error) {
        failures.push({ error, key });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(5, keys.length) }, () => worker()));
  if (failures.length) {
    failures.forEach(({ error, key }) =>
      console.error(`Failed to delete ${key}:`, error instanceof Error ? error.message : error),
    );
    throw new Error(`${failures.length} OSS objects could not be deleted`);
  }
}

async function main() {
  const databaseUrl = requireEnvironment('DATABASE_URL');
  const bucket = requireEnvironment('OSS_BUCKET');
  const execute = process.argv.includes('--delete');
  const minimumAgeHours = parseMinimumAgeHours();
  const cutoff = Date.now() - minimumAgeHours * 60 * 60 * 1000;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const client = new OSS({
    accessKeyId: requireEnvironment('OSS_ACCESS_KEY_ID'),
    accessKeySecret: requireEnvironment('OSS_ACCESS_KEY_SECRET'),
    bucket,
    endpoint: requireEnvironment('OSS_ENDPOINT'),
    region: requireEnvironment('OSS_REGION'),
    secure: true,
  });

  try {
    const [products, objects] = await Promise.all([
      prisma.beadProduct.findMany({
        select: { imageKey: true },
        where: { imageKey: { not: null } },
      }),
      listAllObjects(client),
    ]);
    const referencedKeys = new Set(
      products
        .map(({ imageKey }) => (imageKey ? normalizeObjectKey(imageKey) : ''))
        .filter(Boolean),
    );
    const imageObjects = objects.filter(
      (object) => object.name !== prefix && imagePattern.test(object.name),
    );
    const objectKeys = new Set(imageObjects.map((object) => object.name));
    const unusedObjects = imageObjects.filter((object) => !referencedKeys.has(object.name));
    const candidates = unusedObjects.filter(
      (object) => new Date(object.lastModified).getTime() <= cutoff,
    );
    const protectedRecent = unusedObjects.filter(
      (object) => new Date(object.lastModified).getTime() > cutoff,
    );
    const missingReferences = [...referencedKeys].filter((key) => !objectKeys.has(key));
    const reclaimableBytes = candidates.reduce((sum, object) => sum + object.size, 0);

    console.log(`Bucket: oss://${bucket}/${prefix}`);
    console.log(`OSS images: ${imageObjects.length}`);
    console.log(`Database image references: ${referencedKeys.size}`);
    console.log(`Unused images eligible for deletion: ${candidates.length}`);
    console.log(`Reclaimable storage: ${formatBytes(reclaimableBytes)}`);
    console.log(`Recent unused images protected (${minimumAgeHours}h): ${protectedRecent.length}`);
    console.log(`Database references missing in OSS: ${missingReferences.length}`);

    if (candidates.length) {
      console.log('\nUnused image candidates:');
      candidates.forEach((object) =>
        console.log(`- ${object.name} | ${formatBytes(object.size)} | ${object.lastModified}`),
      );
    }
    if (missingReferences.length) {
      console.log('\nMissing referenced images:');
      missingReferences.forEach((key) => console.log(`- ${key}`));
    }

    if (!execute) {
      console.log('\nDry run only. Re-run with --delete to remove the listed candidates.');
      return;
    }
    if (!candidates.length) {
      console.log('\nNothing to delete.');
      return;
    }

    await deleteConcurrently(
      client,
      candidates.map((object) => object.name),
    );
    const remainingKeys = new Set((await listAllObjects(client)).map((object) => object.name));
    const notDeleted = candidates.filter((object) => remainingKeys.has(object.name));
    if (notDeleted.length) {
      throw new Error(`${notDeleted.length} deleted objects are still present after verification`);
    }
    console.log(`\nVerified: deleted ${candidates.length} unused images.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
