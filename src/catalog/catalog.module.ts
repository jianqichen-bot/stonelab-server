import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { AdminCatalogController } from './admin-catalog.controller.js';
import { AppCatalogController } from './app-catalog.controller.js';
import { CatalogService } from './catalog.service.js';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [AdminCatalogController, AppCatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
