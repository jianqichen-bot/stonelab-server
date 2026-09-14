import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CartItemSource, RecordStatus } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { OssAssetService } from '../storage/oss-asset.service.js';
import { CartService } from './cart.service.js';
import { CertificateCode, PackageCode, ShippingMethod } from './dto/cart.dto.js';

const clientId = 'client_test_1234';

describe('CartService', () => {
  it('returns an empty cart without creating one', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const service = createService({ appCart: { findUnique } });

    await expect(service.get(clientId)).resolves.toEqual({
      items: [],
      itemCount: 0,
      selectedCount: 0,
      selectedSubtotalCents: 0,
      allSelected: false,
    });
  });

  it('rejects an invalid client identifier', async () => {
    const service = createService({});
    await expect(service.get('bad')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('calculates cart prices from current variant prices', async () => {
    const findUnique = vi.fn().mockResolvedValue({ items: [cartItem()] });
    const service = createService({ appCart: { findUnique } });

    const result = await service.get(clientId);

    expect(result.selectedSubtotalCents).toBe(2400);
    expect(result.items[0]).toMatchObject({
      id: 'cart-item-1',
      imageUrl: 'signed:beads/pearl.png',
      subtotalCents: 2400,
      wristCircumferenceCm: 19.8,
      materials: [{ name: '贝珠', unitPriceCents: 600, quantity: 4, subtotalCents: 2400 }],
    });
  });

  it('adds express shipping to the checkout total', async () => {
    const findMany = vi.fn().mockResolvedValue([cartItem()]);
    const service = createService({ cartItem: { findMany } });

    await expect(
      service.checkoutPreview(clientId, {
        itemIds: ['cart-item-1'],
        shippingMethod: ShippingMethod.EXPRESS,
      }),
    ).resolves.toMatchObject({
      itemCount: 1,
      subtotalCents: 2400,
      shipping: { method: 'EXPRESS', feeCents: 1500, company: '顺丰快递', estimatedDays: 3 },
      totalAmountCents: 3900,
    });
  });

  it('does not allow checkout with items owned by another client', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = createService({ cartItem: { findMany } });

    await expect(
      service.checkoutPreview(clientId, {
        itemIds: ['another-cart-item'],
        shippingMethod: ShippingMethod.STANDARD,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('normalizes repeated variants and validates stock when adding an item', async () => {
    const variantFindMany = vi
      .fn()
      .mockResolvedValue([
        {
          id: 10,
          status: RecordStatus.ENABLED,
          stock: 8,
          product: { status: RecordStatus.ENABLED },
        },
      ]);
    const upsert = vi.fn().mockResolvedValue({ id: 'cart-1' });
    const create = vi.fn().mockResolvedValue(cartItem());
    const service = createService({
      appCart: { upsert },
      beadVariant: { findMany: variantFindMany },
      cartItem: { create },
    });

    await service.add(clientId, {
      source: CartItemSource.DIY,
      title: '定制手串',
      packageCode: PackageCode.STANDARD,
      certificateCode: CertificateCode.NONE,
      materials: [
        { variantId: 10, quantity: 1 },
        { variantId: 10, quantity: 3 },
      ],
    });

    expect(variantFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [10] } } }),
    );
    const createInput = create.mock.calls[0]![0] as {
      data: { materials: { create: { variantId: number; quantity: number; position: number }[] } };
    };
    expect(createInput.data.materials.create).toEqual([
      { variantId: 10, quantity: 4, position: 0 },
    ]);
  });
});

function cartItem() {
  return {
    id: 'cart-item-1',
    cartId: 'cart-1',
    source: CartItemSource.DIY,
    title: '定制手串',
    previewImageKey: null,
    wristCircumferenceMm: '198.00',
    recommendedWristMin: '16.30',
    recommendedWristMax: '17.00',
    packageCode: 'STANDARD',
    certificateCode: 'NONE',
    selected: true,
    createdAt: new Date('2026-09-15T00:00:00Z'),
    updatedAt: new Date('2026-09-15T00:00:00Z'),
    materials: [
      {
        id: 1n,
        cartItemId: 'cart-item-1',
        variantId: 10,
        quantity: 4,
        position: 0,
        variant: {
          id: 10,
          productId: 1,
          sku: 'pearl-10',
          label: '10 mm',
          diameterMm: '10.00',
          unitPriceCents: 600,
          stock: 8,
          lowStockThreshold: 2,
          status: RecordStatus.ENABLED,
          createdAt: new Date('2026-09-15T00:00:00Z'),
          updatedAt: new Date('2026-09-15T00:00:00Z'),
          product: {
            id: 1,
            categoryId: 1,
            name: '贝珠',
            slug: 'pearl',
            mineralType: null,
            color: null,
            origin: null,
            shortMeaning: null,
            description: null,
            imageKey: 'beads/pearl.png',
            shape: 'ROUND',
            sort: 0,
            status: RecordStatus.ENABLED,
            createdAt: new Date('2026-09-15T00:00:00Z'),
            updatedAt: new Date('2026-09-15T00:00:00Z'),
          },
        },
      },
    ],
  };
}

function createService(prismaShape: object) {
  const assets = { signedUrl: (key: string) => `signed:${key}` };
  return new CartService(
    prismaShape as PrismaService,
    assets as Pick<OssAssetService, 'signedUrl'> as OssAssetService,
  );
}
