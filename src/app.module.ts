import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { ConfigModule } from './config/config.module.js';
import { HealthController } from './health/health.controller.js';
import { OrderModule } from './order/order.module.js';
import { SystemModule } from './system/system.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, CatalogModule, OrderModule, SystemModule],
  controllers: [HealthController],
})
export class AppModule {}
