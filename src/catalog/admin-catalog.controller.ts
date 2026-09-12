import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { RequestUser } from '../auth/auth.types.js';
import { OssAssetService } from '../storage/oss-asset.service.js';
import { CatalogService } from './catalog.service.js';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';
import { AdjustInventoryDto } from './dto/inventory.dto.js';
import {
  CreateProductDto,
  CreateVariantDto,
  UpdateProductDto,
  UpdateVariantDto,
} from './dto/product.dto.js';
import { ProductQueryDto } from './dto/query.dto.js';

@ApiTags('admin-catalog')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'admin/catalog', version: VERSION_NEUTRAL })
export class AdminCatalogController {
  constructor(
    @Inject(CatalogService) private readonly catalog: CatalogService,
    @Inject(OssAssetService) private readonly assets: OssAssetService,
  ) {}

  @Get('assets') listAssets() {
    return this.assets.listBeadImages();
  }
  @Post('assets') async uploadAsset(@Req() request: FastifyRequest) {
    const file = await request.file();
    if (!file) throw new BadRequestException('请选择图片文件');
    return this.assets.uploadBeadImage(file.filename, file.mimetype, await file.toBuffer());
  }

  @Get('categories') listCategories() {
    return this.catalog.listCategories();
  }
  @Post('categories') createCategory(@Body() input: CreateCategoryDto) {
    return this.catalog.createCategory(input);
  }
  @Patch('categories/:id') updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: UpdateCategoryDto,
  ) {
    return this.catalog.updateCategory(id, input);
  }
  @Delete('categories/:id') deleteCategory(@Param('id', ParseIntPipe) id: number) {
    return this.catalog.deleteCategory(id);
  }

  @Get('products') listProducts(@Query() query: ProductQueryDto) {
    return this.catalog.listProducts(query);
  }
  @Get('products/:id') getProduct(@Param('id', ParseIntPipe) id: number) {
    return this.catalog.getProduct(id);
  }
  @Post('products') createProduct(@Body() input: CreateProductDto) {
    return this.catalog.createProduct(input);
  }
  @Patch('products/:id') updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: UpdateProductDto,
  ) {
    return this.catalog.updateProduct(id, input);
  }
  @Delete('products/:id') deleteProduct(@Param('id', ParseIntPipe) id: number) {
    return this.catalog.deleteProduct(id);
  }

  @Post('products/:productId/variants') createVariant(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() input: CreateVariantDto,
  ) {
    return this.catalog.createVariant(productId, input);
  }
  @Patch('variants/:id') updateVariant(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: UpdateVariantDto,
  ) {
    return this.catalog.updateVariant(id, input);
  }
  @Delete('variants/:id') deleteVariant(@Param('id', ParseIntPipe) id: number) {
    return this.catalog.deleteVariant(id);
  }
  @Post('variants/:id/inventory') adjustInventory(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: AdjustInventoryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.catalog.adjustInventory(id, input, user);
  }
  @Get('variants/:id/inventory-records') listInventoryRecords(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.catalog.listInventoryRecords(id);
  }
}
