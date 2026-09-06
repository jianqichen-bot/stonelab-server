import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RecordStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  listCategories(enabledOnly = false) {
    return this.prisma.category.findMany({
      where: enabledOnly ? { status: RecordStatus.ENABLED } : undefined,
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });
  }

  createCategory(input: CreateCategoryDto) {
    return this.prisma.category.create({ data: input });
  }

  updateCategory(id: number, input: UpdateCategoryDto) {
    if (input.parentId === id) throw new BadRequestException('分类不能将自己设为父分类');
    return this.prisma.category.update({ where: { id }, data: input });
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
    return { items, total, page: query.page, pageSize: query.pageSize };
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
    return product;
  }

  createProduct(input: CreateProductDto) {
    const { variants, ...product } = input;
    return this.prisma.beadProduct.create({
      data: { ...product, variants: variants?.length ? { create: variants } : undefined },
      include: { variants: true },
    });
  }

  updateProduct(id: number, input: UpdateProductDto) {
    return this.prisma.beadProduct.update({ where: { id }, data: input });
  }

  async deleteProduct(id: number) {
    await this.prisma.beadProduct.delete({ where: { id } });
    return true;
  }

  createVariant(productId: number, input: CreateVariantDto) {
    return this.prisma.beadVariant.create({ data: { ...input, productId } });
  }

  updateVariant(id: number, input: UpdateVariantDto) {
    return this.prisma.beadVariant.update({ where: { id }, data: input });
  }

  async adjustInventory(id: number, input: AdjustInventoryDto, operator: RequestUser) {
    return this.prisma.$transaction(
      async (tx) => {
        const variant = await tx.beadVariant.findUnique({ where: { id } });
        if (!variant) throw new NotFoundException('SKU 不存在');
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
}
