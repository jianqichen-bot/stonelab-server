import { Body, Controller, Delete, Get, Headers, Inject, Param, Post, Put } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import {
  AddCartItemDto,
  CheckoutPreviewDto,
  UpdateCartItemDto,
  UpdateCartSelectionDto,
} from './dto/cart.dto.js';
import { CartService } from './cart.service.js';

@ApiTags('app-cart')
@ApiHeader({ name: 'x-client-id', required: true, description: '小程序游客客户端标识' })
@Controller({ path: 'app/cart', version: '1' })
export class CartController {
  constructor(@Inject(CartService) private readonly cart: CartService) {}

  @Get()
  get(@Headers('x-client-id') clientId?: string) {
    return this.cart.get(clientId);
  }

  @Post('items')
  add(@Headers('x-client-id') clientId: string | undefined, @Body() input: AddCartItemDto) {
    return this.cart.add(clientId, input);
  }

  @Put('items/:id')
  update(
    @Headers('x-client-id') clientId: string | undefined,
    @Param('id') id: string,
    @Body() input: UpdateCartItemDto,
  ) {
    return this.cart.update(clientId, id, input);
  }

  @Delete('items/:id')
  remove(@Headers('x-client-id') clientId: string | undefined, @Param('id') id: string) {
    return this.cart.remove(clientId, id);
  }

  @Put('selection')
  updateSelection(
    @Headers('x-client-id') clientId: string | undefined,
    @Body() input: UpdateCartSelectionDto,
  ) {
    return this.cart.updateSelection(clientId, input.selected);
  }

  @Post('checkout-preview')
  checkoutPreview(
    @Headers('x-client-id') clientId: string | undefined,
    @Body() input: CheckoutPreviewDto,
  ) {
    return this.cart.checkoutPreview(clientId, input);
  }
}
