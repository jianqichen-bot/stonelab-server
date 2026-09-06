import { Inject, Injectable } from '@nestjs/common';
import { jwtVerify, SignJWT } from 'jose';
import { ConfigService } from '../config/config.service.js';
import type { AccessTokenPayload, RefreshTokenPayload } from './auth.types.js';

const encoder = new TextEncoder();

@Injectable()
export class TokenService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async issue(user: { id: string; username: string; roles: string[] }) {
    const now = Math.floor(Date.now() / 1000);
    const accessToken = await new SignJWT({
      username: user.username,
      roles: user.roles,
      type: 'access',
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(user.id)
      .setIssuedAt(now)
      .setExpirationTime(this.config.get('JWT_ACCESS_EXPIRES_IN', '2h'))
      .sign(encoder.encode(this.config.getOrThrow<string>('JWT_ACCESS_SECRET')));
    const refreshToken = await new SignJWT({ type: 'refresh' })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(user.id)
      .setIssuedAt(now)
      .setExpirationTime(this.config.get('JWT_REFRESH_EXPIRES_IN', '30d'))
      .sign(encoder.encode(this.config.getOrThrow<string>('JWT_REFRESH_SECRET')));
    return { accessToken, refreshToken };
  }

  async verifyAccess(token: string): Promise<AccessTokenPayload> {
    const { payload } = await jwtVerify(
      token,
      encoder.encode(this.config.getOrThrow<string>('JWT_ACCESS_SECRET')),
      { algorithms: ['HS256'] },
    );
    if (
      !payload.sub ||
      payload.type !== 'access' ||
      typeof payload.username !== 'string' ||
      !Array.isArray(payload.roles)
    ) {
      throw new Error('invalid access token');
    }
    return payload as unknown as AccessTokenPayload;
  }

  async verifyRefresh(token: string): Promise<RefreshTokenPayload> {
    const { payload } = await jwtVerify(
      token,
      encoder.encode(this.config.getOrThrow<string>('JWT_REFRESH_SECRET')),
      { algorithms: ['HS256'] },
    );
    if (!payload.sub || payload.type !== 'refresh') throw new Error('invalid refresh token');
    return payload as unknown as RefreshTokenPayload;
  }
}
