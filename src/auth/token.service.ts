import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { decodeJwt, jwtVerify, SignJWT } from 'jose';
import { ConfigService } from '../config/config.service.js';
import type { AccessTokenPayload, RefreshTokenPayload } from './auth.types.js';
import { RefreshSessionService } from './refresh-session.service.js';

const encoder = new TextEncoder();

@Injectable()
export class TokenService {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(RefreshSessionService) private readonly sessions: RefreshSessionService,
  ) {}

  async issue(user: { id: string; username: string; roles: string[] }) {
    const accessToken = await this.issueAccess(user);
    const now = Math.floor(Date.now() / 1000);
    const sessionId = randomUUID();
    const refreshToken = await new SignJWT({ type: 'refresh' })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setJti(sessionId)
      .setSubject(user.id)
      .setIssuedAt(now)
      .setExpirationTime(this.config.get('JWT_REFRESH_EXPIRES_IN', '30d'))
      .sign(encoder.encode(this.config.getOrThrow<string>('JWT_REFRESH_SECRET')));
    const expiration = decodeJwt(refreshToken).exp;
    if (!expiration) throw new Error('refresh token expiration is required');
    await this.sessions.create(sessionId, user.id, refreshToken, Math.max(1, expiration - now));
    return { accessToken, refreshToken };
  }

  async issueAccess(user: { id: string; username: string; roles: string[] }) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({
      username: user.username,
      roles: user.roles,
      type: 'access',
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(user.id)
      .setIssuedAt(now)
      .setExpirationTime(this.config.get('JWT_ACCESS_EXPIRES_IN', '15m'))
      .sign(encoder.encode(this.config.getOrThrow<string>('JWT_ACCESS_SECRET')));
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
    if (!payload.sub || !payload.jti || payload.type !== 'refresh') {
      throw new Error('invalid refresh token');
    }
    if (!(await this.sessions.isActive(payload.jti, payload.sub, token))) {
      throw new Error('refresh session is inactive');
    }
    return payload as unknown as RefreshTokenPayload;
  }

  async revokeRefresh(token: string) {
    try {
      const { payload } = await jwtVerify(
        token,
        encoder.encode(this.config.getOrThrow<string>('JWT_REFRESH_SECRET')),
        { algorithms: ['HS256'] },
      );
      if (payload.jti) await this.sessions.revoke(payload.jti);
    } catch {
      // Logout remains idempotent when the cookie is missing, invalid, or expired.
    }
  }
}
