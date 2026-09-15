import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service.js';

interface RefreshSession {
  tokenHash: string;
  userId: string;
}

@Injectable()
export class RefreshSessionService {
  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  async create(sessionId: string, userId: string, token: string, ttlSeconds: number) {
    const session: RefreshSession = { userId, tokenHash: this.hash(token) };
    await this.redis.set(this.key(sessionId), JSON.stringify(session), ttlSeconds);
  }

  async isActive(sessionId: string, userId: string, token: string) {
    const value = await this.redis.get(this.key(sessionId));
    if (!value) return false;

    try {
      const session = JSON.parse(value) as RefreshSession;
      return session.userId === userId && session.tokenHash === this.hash(token);
    } catch {
      return false;
    }
  }

  revoke(sessionId: string) {
    return this.redis.delete(this.key(sessionId));
  }

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private key(sessionId: string) {
    return `auth:session:${sessionId}`;
  }
}
