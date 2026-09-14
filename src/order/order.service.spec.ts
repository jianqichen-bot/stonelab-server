import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OrderStatus, PaymentStatus } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { OssAssetService } from '../storage/oss-asset.service.js';
import { OrderService } from './order.service.js';

describe('OrderService', () => {
  it('rejects an invalid status transition', async () => {
    const service = createService({
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'order-1',
          status: OrderStatus.PENDING_PAYMENT,
        }),
      },
    });

    await expect(
      service.updateStatus('order-1', { status: OrderStatus.SHIPPED }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records payment state when an order is marked as paid', async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({ id: 'order-1', status: OrderStatus.PENDING_PAYMENT })
      .mockResolvedValueOnce(orderDetail());
    const update = vi
      .fn<
        (input: {
          data: {
            paidAt: Date;
            paymentStatus: PaymentStatus;
            status: OrderStatus;
          };
          where: { id: string };
        }) => Promise<void>
      >()
      .mockResolvedValue(undefined);
    const service = createService({ order: { findUnique, update } });

    await service.updateStatus('order-1', { status: OrderStatus.PAID });

    const input = update.mock.calls[0]![0];
    expect(input.where).toEqual({ id: 'order-1' });
    expect(input.data.paidAt).toBeInstanceOf(Date);
    expect(input.data.paymentStatus).toBe(PaymentStatus.PAID);
    expect(input.data.status).toBe(OrderStatus.PAID);
  });

  it('maps stored item values and signs image URLs in order details', async () => {
    const service = createService({
      order: { findUnique: vi.fn().mockResolvedValue(orderDetail()) },
    });

    const result = await service.detail('order-1');

    expect(result.items[0]).toMatchObject({
      diameterMm: 8,
      id: '1',
      imageUrl: 'signed:orders/order-1/crystal.png',
    });
  });
});

function createService(prismaShape: object) {
  return new OrderService(
    prismaShape as PrismaService,
    { signedUrl: (key: string) => `signed:${key}` } as OssAssetService,
  );
}

function orderDetail() {
  return {
    id: 'order-1',
    status: OrderStatus.PAID,
    items: [
      {
        id: 1n,
        imageKey: 'orders/order-1/crystal.png',
        diameterMm: '8.00',
      },
    ],
  };
}
