import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RecordStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OssAssetService } from '../storage/oss-asset.service.js';
import type { AddCartItemDto, CheckoutPreviewDto, UpdateCartItemDto } from './dto/cart.dto.js';
import { ShippingMethod } from './dto/cart.dto.js';

const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const EXPRESS_SHIPPING_FEE_CENTS = 1_500;
const cartItemInclude = {
  materials: {
    orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
    include: { variant: { include: { product: true } } },
  },
} satisfies Prisma.CartItemInclude;

type CartItemWithMaterials = Prisma.CartItemGetPayload<{ include: typeof cartItemInclude }>;

@Injectable()
export class CartService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OssAssetService) private readonly assets: OssAssetService,
  ) {}

  async get(clientId?: string) {
    const normalizedClientId = this.validateClientId(clientId);
    const cart = await this.prisma.appCart.findUnique({
      where: { clientId: normalizedClientId },
      include: { items: { orderBy: { createdAt: 'desc' }, include: cartItemInclude } },
    });
    return this.toCartResponse(cart?.items ?? []);
  }

  async add(clientId: string | undefined, input: AddCartItemDto) {
    const normalizedClientId = this.validateClientId(clientId);
    const materials = this.normalizeMaterials(input.materials);
    if (materials.some((material) => material.quantity > 99)) {
      throw new BadRequestException('单个珠子规格数量不能超过 99');
    }
    if (
      input.recommendedWristMinCm !== undefined &&
      input.recommendedWristMaxCm !== undefined &&
      input.recommendedWristMinCm > input.recommendedWristMaxCm
    ) {
      throw new BadRequestException('建议净手围区间无效');
    }
    await this.validateMaterials(materials);
    const cart = await this.prisma.appCart.upsert({
      where: { clientId: normalizedClientId },
      create: { clientId: normalizedClientId },
      update: {},
      select: { id: true },
    });
    const item = await this.prisma.cartItem.create({
      data: {
        cartId: cart.id,
        source: input.source,
        title: input.title.trim(),
        previewImageKey: input.previewImageKey?.trim() || null,
        wristCircumferenceMm:
          input.wristCircumferenceCm === undefined ? null : input.wristCircumferenceCm * 10,
        recommendedWristMin: input.recommendedWristMinCm,
        recommendedWristMax: input.recommendedWristMaxCm,
        packageCode: input.packageCode,
        certificateCode: input.certificateCode,
        materials: {
          create: materials.map((material, position) => ({ ...material, position })),
        },
      },
      include: cartItemInclude,
    });
    return this.toItemResponse(item);
  }

  async update(clientId: string | undefined, id: string, input: UpdateCartItemDto) {
    const cartItem = await this.findOwnedItem(this.validateClientId(clientId), id);
    const updated = await this.prisma.cartItem.update({
      where: { id: cartItem.id },
      data: input,
      include: cartItemInclude,
    });
    return this.toItemResponse(updated);
  }

  async remove(clientId: string | undefined, id: string) {
    const cartItem = await this.findOwnedItem(this.validateClientId(clientId), id);
    await this.prisma.cartItem.delete({ where: { id: cartItem.id } });
    return true;
  }

  async updateSelection(clientId: string | undefined, selected: boolean) {
    const normalizedClientId = this.validateClientId(clientId);
    const cart = await this.prisma.appCart.findUnique({
      where: { clientId: normalizedClientId },
      select: { id: true },
    });
    if (!cart) return this.toCartResponse([]);
    await this.prisma.cartItem.updateMany({ where: { cartId: cart.id }, data: { selected } });
    return this.get(normalizedClientId);
  }

  async checkoutPreview(clientId: string | undefined, input: CheckoutPreviewDto) {
    const normalizedClientId = this.validateClientId(clientId);
    const uniqueItemIds = [...new Set(input.itemIds)];
    if (uniqueItemIds.length !== input.itemIds.length) {
      throw new BadRequestException('结算商品不能重复');
    }
    const items = await this.prisma.cartItem.findMany({
      where: { id: { in: uniqueItemIds }, cart: { clientId: normalizedClientId } },
      orderBy: { createdAt: 'desc' },
      include: cartItemInclude,
    });
    if (items.length !== uniqueItemIds.length) throw new NotFoundException('部分购物车商品不存在');
    this.ensureAvailable(items);

    const itemResponses = items.map((item) => this.toItemResponse(item));
    const subtotalCents = itemResponses.reduce((sum, item) => sum + item.subtotalCents, 0);
    const shippingFeeCents =
      input.shippingMethod === ShippingMethod.EXPRESS ? EXPRESS_SHIPPING_FEE_CENTS : 0;
    return {
      items: itemResponses,
      itemCount: itemResponses.length,
      subtotalCents,
      packageAndCertificateFeeCents: 0,
      shipping: {
        method: input.shippingMethod,
        feeCents: shippingFeeCents,
        company: input.shippingMethod === ShippingMethod.EXPRESS ? '顺丰快递' : '中通包邮',
        estimatedDays: input.shippingMethod === ShippingMethod.EXPRESS ? 3 : 5,
      },
      totalAmountCents: subtotalCents + shippingFeeCents,
    };
  }

  private async findOwnedItem(clientId: string, id: string) {
    const item = await this.prisma.cartItem.findFirst({
      where: { id, cart: { clientId } },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('购物车商品不存在');
    return item;
  }

  private async validateMaterials(materials: { variantId: number; quantity: number }[]) {
    const variants = await this.prisma.beadVariant.findMany({
      where: { id: { in: materials.map((material) => material.variantId) } },
      select: { id: true, status: true, stock: true, product: { select: { status: true } } },
    });
    if (variants.length !== materials.length) throw new BadRequestException('部分珠子规格不存在');
    const byId = new Map(variants.map((variant) => [variant.id, variant]));
    for (const material of materials) {
      const variant = byId.get(material.variantId)!;
      if (
        variant.status !== RecordStatus.ENABLED ||
        variant.product.status !== RecordStatus.ENABLED
      )
        throw new BadRequestException('设计中包含已下架珠子');
      if (variant.stock < material.quantity)
        throw new BadRequestException('设计中部分珠子库存不足');
    }
  }

  private ensureAvailable(items: CartItemWithMaterials[]) {
    for (const item of items) {
      if (!item.materials.length) throw new BadRequestException('购物车商品没有材料');
      for (const material of item.materials) {
        if (
          material.variant.status !== RecordStatus.ENABLED ||
          material.variant.product.status !== RecordStatus.ENABLED
        ) {
          throw new BadRequestException(`“${item.title}”包含已下架珠子`);
        }
        if (material.variant.stock < material.quantity) {
          throw new BadRequestException(`“${item.title}”部分珠子库存不足`);
        }
      }
    }
  }

  private normalizeMaterials(materials: AddCartItemDto['materials']) {
    const quantities = new Map<number, number>();
    for (const material of materials) {
      quantities.set(
        material.variantId,
        (quantities.get(material.variantId) ?? 0) + material.quantity,
      );
    }
    return [...quantities].map(([variantId, quantity]) => ({ variantId, quantity }));
  }

  private toCartResponse(items: CartItemWithMaterials[]) {
    const itemResponses = items.map((item) => this.toItemResponse(item));
    const selectedItems = itemResponses.filter((item) => item.selected);
    return {
      items: itemResponses,
      itemCount: itemResponses.length,
      selectedCount: selectedItems.length,
      selectedSubtotalCents: selectedItems.reduce((sum, item) => sum + item.subtotalCents, 0),
      allSelected: itemResponses.length > 0 && selectedItems.length === itemResponses.length,
    };
  }

  private toItemResponse(item: CartItemWithMaterials) {
    const materials = item.materials.map((material) => ({
      variantId: material.variantId,
      productId: material.variant.productId,
      name: material.variant.product.name,
      imageUrl: material.variant.product.imageKey
        ? this.assets.signedUrl(material.variant.product.imageKey)
        : null,
      sizeMm: material.variant.diameterMm === null ? null : Number(material.variant.diameterMm),
      unitPriceCents: material.variant.unitPriceCents,
      quantity: material.quantity,
      subtotalCents: material.variant.unitPriceCents * material.quantity,
    }));
    const fallbackImageKey = item.materials.find((material) => material.variant.product.imageKey)
      ?.variant.product.imageKey;
    return {
      id: item.id,
      source: item.source,
      title: item.title,
      imageUrl: item.previewImageKey
        ? this.assets.signedUrl(item.previewImageKey)
        : fallbackImageKey
          ? this.assets.signedUrl(fallbackImageKey)
          : null,
      wristCircumferenceCm:
        item.wristCircumferenceMm === null ? null : Number(item.wristCircumferenceMm) / 10,
      recommendedWristMinCm:
        item.recommendedWristMin === null ? null : Number(item.recommendedWristMin),
      recommendedWristMaxCm:
        item.recommendedWristMax === null ? null : Number(item.recommendedWristMax),
      packageCode: item.packageCode,
      certificateCode: item.certificateCode,
      selected: item.selected,
      materials,
      subtotalCents: materials.reduce((sum, material) => sum + material.subtotalCents, 0),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private validateClientId(clientId?: string) {
    const normalized = clientId?.trim();
    if (!normalized || !CLIENT_ID_PATTERN.test(normalized)) {
      throw new BadRequestException('缺少有效的客户端标识');
    }
    return normalized;
  }
}
