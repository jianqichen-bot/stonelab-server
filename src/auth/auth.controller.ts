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
import { LoginCryptoService } from './login-crypto.service.js';

@ApiTags('admin-auth')
@Controller({ version: VERSION_NEUTRAL })
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(LoginCryptoService) private readonly loginCrypto: LoginCryptoService,
  ) {}

  @Get('auth/encryption-key')
  getLoginEncryptionKey(@Res({ passthrough: true }) reply: FastifyReply) {
    reply.header('Cache-Control', 'no-store');
    return this.loginCrypto.getPublicKey();
  }

  @Post('auth/login')
  @HttpCode(200)
  async login(@Body() input: LoginDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const password = this.loginCrypto.decryptPassword(
      input.keyId,
      input.encryptedKey,
      input.iv,
      input.encryptedPassword,
    );
    const result = await this.auth.login({ username: input.username, password });
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
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.auth.logout(request.cookies.jwt ?? '');
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
  getMenus(@CurrentUser() user: RequestUser) {
    return this.auth.getMenus(user.sub);
  }

  @Get('menu/translations')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  getMenuTranslations(@CurrentUser() user: RequestUser) {
    return this.auth.getMenuTranslations(user.sub);
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
