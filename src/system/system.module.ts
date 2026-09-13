import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { ProfileController, SystemController } from './system.controller.js';
import { SystemService } from './system.service.js';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [SystemController, ProfileController],
  providers: [SystemService],
})
export class SystemModule {}
