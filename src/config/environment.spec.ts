import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './environment.js';

describe('validateEnvironment', () => {
  it('converts a string port when running through tsx', () => {
    const config = validateEnvironment({
      PORT: '3100',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      JWT_ACCESS_SECRET: 'access-secret-with-at-least-32-characters',
      JWT_REFRESH_SECRET: 'refresh-secret-with-at-least-32-characters',
    });

    expect(config.PORT).toBe(3100);
  });
});
