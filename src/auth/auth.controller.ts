import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ConfigService } from '../config/config.service.js';
import type { RequestUser } from './auth.types.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';

@ApiTags('admin-auth')
@Controller({ version: VERSION_NEUTRAL })
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  @Post('auth/login')
  @HttpCode(200)
  async login(@Body() input: LoginDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.auth.login(input);
    reply.setCookie('jwt', result.refreshToken, this.refreshCookieOptions());
    return result;
  }

  @Post('auth/refresh')
  @HttpCode(200)
  refresh(@Body() input: RefreshTokenDto, @Req() request: FastifyRequest) {
    const refreshToken = input.refreshToken ?? request.cookies.jwt;
    return this.auth.refresh(refreshToken ?? '');
  }

  @Post('auth/logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) reply: FastifyReply) {
    reply.clearCookie('jwt', { path: '/api/auth' });
    return true;
  }

  @Get('auth/codes')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  getCodes(@CurrentUser() user: RequestUser) {
    return this.auth.getCodes(user.sub);
  }

  @Get('user/info')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  getUserInfo(@CurrentUser() user: RequestUser) {
    return this.auth.getUserInfo(user.sub);
  }

  @Get('menu/all')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  getMenus() {
    return this.auth.getMenus();
  }

  private refreshCookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.config.get<string>('NODE_ENV', 'development') === 'production',
      path: '/api/auth',
      maxAge: 30 * 24 * 60 * 60,
    };
  }
}
