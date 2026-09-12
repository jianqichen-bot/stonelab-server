import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OssAssetService } from '../storage/oss-asset.service.js';
import { AdminCatalogController } from './admin-catalog.controller.js';
import { AppCatalogController } from './app-catalog.controller.js';
import { CatalogService } from './catalog.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AdminCatalogController, AppCatalogController],
  providers: [CatalogService, OssAssetService],
})
export class CatalogModule {}
