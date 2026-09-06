import { describe, expect, it } from 'vitest';
import { ConfigService } from '../config/config.service.js';
import { TokenService } from './token.service.js';

describe('TokenService', () => {
  it('issues and verifies separate access and refresh tokens', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_ACCESS_SECRET = 'access-secret-with-at-least-32-characters';
    process.env.JWT_REFRESH_SECRET = 'refresh-secret-with-at-least-32-characters';
    const service = new TokenService(new ConfigService());

    const tokens = await service.issue({ id: 'user-1', username: 'admin', roles: ['admin'] });
    const access = await service.verifyAccess(tokens.accessToken);
    const refresh = await service.verifyRefresh(tokens.refreshToken);

    expect(access).toMatchObject({ sub: 'user-1', username: 'admin', type: 'access' });
    expect(refresh).toMatchObject({ sub: 'user-1', type: 'refresh' });
    await expect(service.verifyAccess(tokens.refreshToken)).rejects.toThrow();
  });
});
