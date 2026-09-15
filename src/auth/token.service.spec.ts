import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '../config/config.service.js';
import type { RefreshSessionService } from './refresh-session.service.js';
import { TokenService } from './token.service.js';

describe('TokenService', () => {
  it('issues, verifies, and revokes a refresh session', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_ACCESS_SECRET = 'access-secret-with-at-least-32-characters';
    process.env.JWT_REFRESH_SECRET = 'refresh-secret-with-at-least-32-characters';
    process.env.JWT_ACCESS_EXPIRES_IN = '15m';
    const activeSessions = new Map<string, { token: string; userId: string }>();
    const createSession = vi.fn((sessionId: string, userId: string, token: string) => {
      activeSessions.set(sessionId, { token, userId });
    });
    const sessions = {
      create: createSession,
      isActive: vi.fn((sessionId: string, userId: string, token: string) => {
        const session = activeSessions.get(sessionId);
        return session?.userId === userId && session.token === token;
      }),
      revoke: vi.fn((sessionId: string) => {
        activeSessions.delete(sessionId);
      }),
    } as unknown as RefreshSessionService;
    const service = new TokenService(new ConfigService(), sessions);

    const tokens = await service.issue({ id: 'user-1', username: 'admin', roles: ['admin'] });
    const access = await service.verifyAccess(tokens.accessToken);
    const refresh = await service.verifyRefresh(tokens.refreshToken);

    expect(access).toMatchObject({ sub: 'user-1', username: 'admin', type: 'access' });
    expect(refresh).toMatchObject({ sub: 'user-1', type: 'refresh' });
    expect(refresh.jti).toEqual(expect.any(String));
    await expect(service.verifyAccess(tokens.refreshToken)).rejects.toThrow();

    const nextAccessToken = await service.issueAccess({
      id: 'user-1',
      username: 'admin',
      roles: ['admin'],
    });
    await expect(service.verifyAccess(nextAccessToken)).resolves.toMatchObject({
      sub: 'user-1',
      type: 'access',
    });
    expect(createSession).toHaveBeenCalledTimes(1);

    await service.revokeRefresh(tokens.refreshToken);

    await expect(service.verifyRefresh(tokens.refreshToken)).rejects.toThrow(
      'refresh session is inactive',
    );
  });
});
