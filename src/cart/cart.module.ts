import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';

@Module({
  imports: [StorageModule],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
