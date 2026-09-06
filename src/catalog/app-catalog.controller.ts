import { Controller, Get, Inject, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service.js';
import { ProductQueryDto } from './dto/query.dto.js';

@ApiTags('app-catalog')
@Controller({ path: 'app/catalog', version: '1' })
export class AppCatalogController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get('categories')
  listCategories() {
    return this.catalog.listCategories(true);
  }

  @Get('products')
  listProducts(@Query() query: ProductQueryDto) {
    return this.catalog.listProducts(query, true);
  }

  @Get('products/:id')
  getProduct(@Param('id', ParseIntPipe) id: number) {
    return this.catalog.getProduct(id, true);
  }
}
