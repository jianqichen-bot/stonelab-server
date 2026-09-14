import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Query,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { OrderQueryDto, UpdateOrderStatusDto } from './dto/order.dto.js';
import { OrderService } from './order.service.js';

@ApiTags('admin-orders')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller({ path: 'admin/orders', version: VERSION_NEUTRAL })
export class OrderController {
  constructor(@Inject(OrderService) private readonly orders: OrderService) {}

  @Get()
  @RequirePermissions('order:list')
  list(@Query() query: OrderQueryDto) {
    return this.orders.list(query);
  }

  @Get(':id')
  @RequirePermissions('order:list')
  detail(@Param('id') id: string) {
    return this.orders.detail(id);
  }

  @Patch(':id/status')
  @RequirePermissions('order:update')
  updateStatus(@Param('id') id: string, @Body() input: UpdateOrderStatusDto) {
    return this.orders.updateStatus(id, input);
  }
}
