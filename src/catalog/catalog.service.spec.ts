import { describe, expect, it, vi } from 'vitest';
import { BeadShape } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { OssAssetService } from '../storage/oss-asset.service.js';
import { CatalogService } from './catalog.service.js';

describe('CatalogService app catalog', () => {
  it('returns a minimal nested category tree', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: 1, name: '珠子', parentId: null },
      { id: 2, name: '白水晶', parentId: 1 },
      { id: 3, name: '配饰', parentId: null },
    ]);
    const service = createService({ category: { findMany } });

    await expect(service.listAppCategories()).resolves.toEqual([
      { id: 1, name: '珠子', children: [{ id: 2, name: '白水晶' }] },
      { id: 3, name: '配饰', children: [] },
    ]);
  });

  it('returns only fields used by the mini program and hides unavailable products', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 10,
        categoryId: 2,
        imageKey: 'beads/crystal.png',
        name: '白水晶',
        shape: BeadShape.ROUND,
        variants: [{ id: 100, diameterMm: '8.00', unitPriceCents: 800 }],
      },
      {
        id: 11,
        categoryId: 2,
        imageKey: 'beads/unavailable.png',
        name: '无库存珠子',
        shape: BeadShape.ROUND,
        variants: [],
      },
    ]);
    const service = createService({ beadProduct: { findMany } });

    await expect(service.listAppProducts()).resolves.toEqual([
      {
        id: 10,
        categoryId: 2,
        name: '白水晶',
        imageUrl: 'signed:beads/crystal.png',
        shape: 'round',
        variants: [{ id: 100, size: 8, price: 8 }],
      },
    ]);
  });

  it('keeps generated category slugs internal', async () => {
    const create = vi
      .fn<
        (input: { data: { name: string; slug: string } }) => Promise<{
          id: number;
          name: string;
          slug: string;
        }>
      >()
      .mockResolvedValue({ id: 4, name: '新分类', slug: 'internal-category' });
    const service = createService({ category: { create } });

    await expect(service.createCategory({ name: '新分类' })).resolves.toEqual({
      id: 4,
      name: '新分类',
    });
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0]![0].data.name).toBe('新分类');
    expect(create.mock.calls[0]![0].data.slug).toMatch(/^category-/);
  });

  it('keeps generated product slugs internal', async () => {
    const create = vi
      .fn<
        (input: {
          data: {
            categoryId: number;
            imageKey: string;
            name: string;
            slug: string;
            variants?: unknown;
          };
          include: { variants: boolean };
        }) => Promise<{
          categoryId: number;
          id: number;
          name: string;
          slug: string;
          variants: never[];
        }>
      >()
      .mockResolvedValue({
        categoryId: 2,
        id: 12,
        name: '新珠子',
        slug: 'internal-product',
        variants: [],
      });
    const service = createService({ beadProduct: { create } });

    await expect(
      service.createProduct({
        categoryId: 2,
        imageKey: 'beads/new-bead.png',
        name: '新珠子',
      }),
    ).resolves.toEqual({
      categoryId: 2,
      id: 12,
      name: '新珠子',
      variants: [],
    });
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0]![0].data.categoryId).toBe(2);
    expect(create.mock.calls[0]![0].data.imageKey).toBe('beads/new-bead.png');
    expect(create.mock.calls[0]![0].data.name).toBe('新珠子');
    expect(create.mock.calls[0]![0].data.slug).toMatch(/^product-/);
    expect(create.mock.calls[0]![0].include).toEqual({ variants: true });
  });
});

function createService(prismaShape: object) {
  const assets = { signedUrl: (key: string) => `signed:${key}` };
  return new CatalogService(
    prismaShape as PrismaService,
    assets as Pick<OssAssetService, 'signedUrl'> as OssAssetService,
  );
}
