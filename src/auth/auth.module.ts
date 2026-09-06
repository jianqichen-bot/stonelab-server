import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { TokenService } from './token.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, TokenService],
  exports: [AuthGuard, TokenService],
})
export class AuthModule {}
