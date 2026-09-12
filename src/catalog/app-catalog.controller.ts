import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service.js';

@ApiTags('app-catalog')
@Controller({ path: 'app/catalog', version: '1' })
export class AppCatalogController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get('categories')
  listCategories() {
    return this.catalog.listAppCategories();
  }

  @Get('products')
  listProducts() {
    return this.catalog.listAppProducts();
  }
}
