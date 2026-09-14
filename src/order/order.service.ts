import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OssAssetService } from '../storage/oss-asset.service.js';
import type { OrderQueryDto, UpdateOrderStatusDto } from './dto/order.dto.js';

const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: [OrderStatus.PAID, OrderStatus.CANCELLED],
  PAID: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.COMPLETED],
  COMPLETED: [],
  CANCELLED: [],
};

@Injectable()
export class OrderService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OssAssetService) private readonly assets: OssAssetService,
  ) {}

  async list(query: OrderQueryDto) {
    const keyword = query.keyword?.trim();
    const where: Prisma.OrderWhereInput = {
      status: query.status,
      ...(keyword
        ? {
            OR: [
              { orderNo: { contains: keyword, mode: 'insensitive' } },
              { recipientName: { contains: keyword, mode: 'insensitive' } },
              { recipientPhone: { contains: keyword } },
              { trackingNo: { contains: keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { _count: { select: { items: true } } },
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      items: items.map(({ _count, ...order }) => ({
        ...order,
        itemCount: _count.items,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async detail(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { orderBy: [{ position: 'asc' }, { id: 'asc' }] } },
    });
    if (!order) throw new NotFoundException('订单不存在');
    return {
      ...order,
      items: order.items.map((item) => ({
        ...item,
        id: item.id.toString(),
        imageUrl: item.imageKey ? this.assets.signedUrl(item.imageKey) : null,
        diameterMm: item.diameterMm === null ? null : Number(item.diameterMm),
      })),
    };
  }

  async updateStatus(id: string, input: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status === input.status) return this.detail(id);
    if (!NEXT_STATUSES[order.status].includes(input.status)) {
      throw new BadRequestException(`订单不能从 ${order.status} 变更为 ${input.status}`);
    }
    const now = new Date();
    await this.prisma.order.update({
      where: { id },
      data: {
        status: input.status,
        ...(input.adminRemark === undefined ? {} : { adminRemark: input.adminRemark.trim() }),
        ...(input.trackingCompany === undefined
          ? {}
          : { trackingCompany: input.trackingCompany.trim() }),
        ...(input.trackingNo === undefined ? {} : { trackingNo: input.trackingNo.trim() }),
        ...(input.status === OrderStatus.PAID
          ? { paidAt: now, paymentStatus: PaymentStatus.PAID }
          : {}),
        ...(input.status === OrderStatus.SHIPPED ? { shippedAt: now } : {}),
        ...(input.status === OrderStatus.COMPLETED ? { completedAt: now } : {}),
        ...(input.status === OrderStatus.CANCELLED ? { cancelledAt: now } : {}),
      },
    });
    return this.detail(id);
  }
}
