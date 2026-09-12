import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, RecordStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OssAssetService } from '../storage/oss-asset.service.js';
import type { RequestUser } from '../auth/auth.types.js';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';
import type { AdjustInventoryDto } from './dto/inventory.dto.js';
import type {
  CreateProductDto,
  CreateVariantDto,
  UpdateProductDto,
  UpdateVariantDto,
} from './dto/product.dto.js';
import type { ProductQueryDto } from './dto/query.dto.js';

@Injectable()
export class CatalogService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OssAssetService) private readonly assets: OssAssetService,
  ) {}

  async listAppCategories() {
    const categories = await this.prisma.category.findMany({
      where: { status: RecordStatus.ENABLED },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, parentId: true },
    });
    const childrenByParent = new Map<number, { id: number; name: string }[]>();
    for (const category of categories) {
      if (category.parentId === null) continue;
      const children = childrenByParent.get(category.parentId) ?? [];
      children.push({ id: category.id, name: category.name });
      childrenByParent.set(category.parentId, children);
    }
    return categories
      .filter((category) => category.parentId === null)
      .map((category) => ({
        id: category.id,
        name: category.name,
        children: childrenByParent.get(category.id) ?? [],
      }));
  }

  async listAppProducts() {
    const products = await this.prisma.beadProduct.findMany({
      where: { imageKey: { not: null }, status: RecordStatus.ENABLED },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        categoryId: true,
        imageKey: true,
        name: true,
        shape: true,
        variants: {
          where: { diameterMm: { not: null }, status: RecordStatus.ENABLED, stock: { gt: 0 } },
          orderBy: [{ diameterMm: 'asc' }, { id: 'asc' }],
          select: { diameterMm: true, id: true, unitPriceCents: true },
        },
      },
    });
    return products
      .filter((product) => product.imageKey && product.variants.length > 0)
      .map((product) => ({
        id: product.id,
        categoryId: product.categoryId,
        name: product.name,
        imageUrl: this.assets.signedUrl(product.imageKey!),
        shape: product.shape.toLowerCase(),
        variants: product.variants.map((variant) => ({
          id: variant.id,
          size: Number(variant.diameterMm),
          price: variant.unitPriceCents / 100,
        })),
      }));
  }

  async listCategories(enabledOnly = false) {
    const categories = await this.prisma.category.findMany({
      where: enabledOnly ? { status: RecordStatus.ENABLED } : undefined,
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });
    return categories.map((category) => this.omitSlug(category));
  }

  async createCategory(input: CreateCategoryDto) {
    const category = await this.prisma.category.create({
      data: { ...input, slug: `category-${randomUUID()}` },
    });
    return this.omitSlug(category);
  }

  async updateCategory(id: number, input: UpdateCategoryDto) {
    if (input.parentId === id) throw new BadRequestException('分类不能将自己设为父分类');
    const category = await this.prisma.category.update({ where: { id }, data: input });
    return this.omitSlug(category);
  }

  async deleteCategory(id: number) {
    const dependencies = await this.prisma.category.findUnique({
      where: { id },
      select: { _count: { select: { children: true, products: true } } },
    });
    if (!dependencies) throw new NotFoundException('分类不存在');
    if (dependencies._count.children || dependencies._count.products) {
      throw new BadRequestException('请先移除该分类下的子分类和商品');
    }
    await this.prisma.category.delete({ where: { id } });
    return true;
  }

  async listProducts(query: ProductQueryDto, publicOnly = false) {
    const where: Prisma.BeadProductWhereInput = {
      categoryId: query.categoryId,
      status: publicOnly ? RecordStatus.ENABLED : query.status,
      ...(query.keyword
        ? {
            OR: [
              { name: { contains: query.keyword, mode: 'insensitive' } },
              { mineralType: { contains: query.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const variantWhere = publicOnly ? { status: RecordStatus.ENABLED } : undefined;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.beadProduct.findMany({
        where,
        include: { category: true, variants: { where: variantWhere, orderBy: { id: 'asc' } } },
        orderBy: [{ sort: 'asc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.beadProduct.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        ...this.omitSlug(item),
        category: this.omitSlug(item.category),
        imageUrl: item.imageKey ? this.assets.signedUrl(item.imageKey) : null,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getProduct(id: number, publicOnly = false) {
    const product = await this.prisma.beadProduct.findFirst({
      where: { id, status: publicOnly ? RecordStatus.ENABLED : undefined },
      include: {
        category: true,
        variants: {
          where: publicOnly ? { status: RecordStatus.ENABLED } : undefined,
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!product) throw new NotFoundException('商品不存在');
    return {
      ...this.omitSlug(product),
      category: this.omitSlug(product.category),
      imageUrl: product.imageKey ? this.assets.signedUrl(product.imageKey) : null,
    };
  }

  async createProduct(input: CreateProductDto) {
    const { variants, ...product } = input;
    const created = await this.prisma.beadProduct.create({
      data: {
        ...product,
        slug: `product-${randomUUID()}`,
        variants: variants?.length
          ? { create: variants.map((variant) => this.withInternalVariantFields(variant)) }
          : undefined,
      },
      include: { variants: true },
    });
    return this.omitSlug(created);
  }

  async updateProduct(id: number, input: UpdateProductDto) {
    const product = await this.prisma.beadProduct.update({ where: { id }, data: input });
    return this.omitSlug(product);
  }

  async deleteProduct(id: number) {
    await this.prisma.beadProduct.delete({ where: { id } });
    return true;
  }

  createVariant(productId: number, input: CreateVariantDto) {
    return this.prisma.beadVariant.create({
      data: { ...this.withInternalVariantFields(input), productId },
    });
  }

  updateVariant(id: number, input: UpdateVariantDto) {
    return this.prisma.beadVariant.update({
      where: { id },
      data: {
        ...input,
        ...(input.diameterMm === undefined ? {} : { label: `${input.diameterMm} mm` }),
      },
    });
  }

  async deleteVariant(id: number) {
    await this.prisma.beadVariant.delete({ where: { id } });
    return true;
  }

  async adjustInventory(id: number, input: AdjustInventoryDto, operator: RequestUser) {
    return this.prisma.$transaction(
      async (tx) => {
        const variant = await tx.beadVariant.findUnique({ where: { id } });
        if (!variant) throw new NotFoundException('规格不存在');
        const stockAfter = variant.stock + input.change;
        if (stockAfter < 0) throw new BadRequestException('库存不足，调整后不能小于 0');
        const updated = await tx.beadVariant.update({ where: { id }, data: { stock: stockAfter } });
        await tx.inventoryRecord.create({
          data: {
            variantId: id,
            change: input.change,
            stockBefore: variant.stock,
            stockAfter,
            type: input.type,
            remark: input.remark,
            operatorId: operator.sub,
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async listInventoryRecords(variantId: number) {
    const records = await this.prisma.inventoryRecord.findMany({
      where: { variantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return records.map((record) => ({ ...record, id: record.id.toString() }));
  }

  private omitSlug<T extends { slug: string }>({ slug: _slug, ...value }: T): Omit<T, 'slug'> {
    void _slug;
    return value;
  }

  private withInternalVariantFields(input: CreateVariantDto) {
    return {
      ...input,
      label: `${input.diameterMm} mm`,
      sku: `variant-${randomUUID()}`,
    };
  }
}
