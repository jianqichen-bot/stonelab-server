import 'dotenv/config';

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { BeadShape, PrismaClient } from '../src/generated/prisma/client.js';
import { fetchLegacyList } from './legacy-bead-api.js';

interface LegacyCategory {
  category_id: number;
  child: LegacyCategory[];
  name: string;
  parent_id: number;
  sort: number;
}

interface LegacyBead {
  bead_id: number;
  category_id: number;
  image: string;
  name: string;
  price: string;
  size: string;
  stock: number;
  type: number;
}

interface AssetManifest {
  assets: { objectKey: string; sourceUrl: string }[];
}

interface ProductGroup {
  categoryId: number;
  image: string;
  name: string;
  shape: BeadShape;
  sourceId: number;
  variants: LegacyBead[];
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

function shapeFromType(type: number): BeadShape {
  if (type === 20) return BeadShape.CUBE;
  if (type === 30) return BeadShape.CHARM;
  if (type === 40) return BeadShape.CHIP;
  return BeadShape.ROUND;
}

function flattenCategories(categories: LegacyCategory[]): LegacyCategory[] {
  return categories.flatMap((category) => [category, ...flattenCategories(category.child)]);
}

function groupProducts(beads: LegacyBead[]): ProductGroup[] {
  const groups = new Map<string, ProductGroup>();
  for (const bead of beads) {
    const key = `${bead.category_id}|${bead.name}|${bead.image}|${bead.type}`;
    const group = groups.get(key) ?? {
      categoryId: bead.category_id,
      image: bead.image,
      name: bead.name,
      shape: shapeFromType(bead.type),
      sourceId: bead.bead_id,
      variants: [],
    };
    group.sourceId = Math.min(group.sourceId, bead.bead_id);
    group.variants.push(bead);
    groups.set(key, group);
  }
  return [...groups.values()];
}

async function main() {
  const [categoryTree, beads, manifestSource] = await Promise.all([
    fetchLegacyList<LegacyCategory>('categoryList'),
    fetchLegacyList<LegacyBead>('list'),
    readFile(resolve('var/imports/bead-assets.json'), 'utf8'),
  ]);
  const manifest = JSON.parse(manifestSource) as AssetManifest;
  const imageKeys = new Map(manifest.assets.map((asset) => [asset.sourceUrl, asset.objectKey]));
  const categories = flattenCategories(categoryTree);
  const categoryIds = new Map<number, number>();

  for (const category of categories.filter((item) => item.parent_id === 0)) {
    const saved = await prisma.category.upsert({
      where: { slug: `legacy-category-${category.category_id}` },
      create: {
        name: category.name,
        slug: `legacy-category-${category.category_id}`,
        sort: category.sort,
      },
      update: { name: category.name, sort: category.sort, parentId: null },
    });
    categoryIds.set(category.category_id, saved.id);
  }
  for (const category of categories.filter((item) => item.parent_id !== 0)) {
    const parentId = categoryIds.get(category.parent_id);
    if (!parentId) throw new Error(`Missing parent category ${category.parent_id}`);
    const saved = await prisma.category.upsert({
      where: { slug: `legacy-category-${category.category_id}` },
      create: {
        name: category.name,
        slug: `legacy-category-${category.category_id}`,
        sort: category.sort,
        parentId,
      },
      update: { name: category.name, sort: category.sort, parentId },
    });
    categoryIds.set(category.category_id, saved.id);
  }

  const groups = groupProducts(beads);
  for (const [sort, group] of groups.entries()) {
    const categoryId = categoryIds.get(group.categoryId);
    const imageKey = imageKeys.get(group.image);
    if (!categoryId) throw new Error(`Missing category ${group.categoryId} for ${group.name}`);
    if (!imageKey) throw new Error(`Missing OSS image mapping for ${group.image}`);
    const slug = `legacy-bead-${group.sourceId}`;
    const product = await prisma.beadProduct.upsert({
      where: { slug },
      create: { categoryId, imageKey, name: group.name, shape: group.shape, slug, sort },
      update: { categoryId, imageKey, name: group.name, shape: group.shape, sort },
    });
    for (const variant of group.variants) {
      const sku = `legacy-bead-${variant.bead_id}`;
      const size = Number(variant.size);
      const priceCents = Math.round(Number(variant.price) * 100);
      if (!Number.isFinite(size) || !Number.isFinite(priceCents)) {
        throw new Error(`Invalid size or price for legacy bead ${variant.bead_id}`);
      }
      await prisma.beadVariant.upsert({
        where: { sku },
        create: {
          diameterMm: size,
          label: `${size} mm`,
          productId: product.id,
          sku,
          stock: variant.stock,
          unitPriceCents: priceCents,
        },
        update: {
          diameterMm: size,
          label: `${size} mm`,
          productId: product.id,
          stock: variant.stock,
          unitPriceCents: priceCents,
        },
      });
    }
  }

  console.log(
    `Imported ${categories.length} categories, ${groups.length} products, and ${beads.length} variants.`,
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
