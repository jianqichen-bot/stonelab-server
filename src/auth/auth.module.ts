import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { PermissionGuard } from './permission.guard.js';
import { TokenService } from './token.service.js';

@Module({
  imports: [StorageModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, PermissionGuard, TokenService],
  exports: [AuthGuard, PermissionGuard, TokenService],
})
export class AuthModule {}
