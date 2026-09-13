import { Module } from '@nestjs/common';
import { OssAssetService } from './oss-asset.service.js';

@Module({
  providers: [OssAssetService],
  exports: [OssAssetService],
})
export class StorageModule {}
