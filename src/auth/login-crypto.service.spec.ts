import {
  createCipheriv,
  publicEncrypt,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { LoginCryptoService } from './login-crypto.service.js';

function encrypt(publicKey: string, payload: object) {
  const aesKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', aesKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return {
    encryptedKey: publicEncrypt(
    { key: publicKey, oaepHash: 'sha256' },
      aesKey,
    ).toString('base64'),
    encryptedPassword: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
  };
}

describe('LoginCryptoService', () => {
  it('decrypts a fresh password payload and rejects replay', () => {
    const service = new LoginCryptoService();
    const key = service.getPublicKey();
    const encrypted = encrypt(key.publicKey, {
      nonce: randomUUID(),
      password: '123456',
      timestamp: Date.now(),
    });

    expect(
      service.decryptPassword(
        key.keyId,
        encrypted.encryptedKey,
        encrypted.iv,
        encrypted.encryptedPassword,
      ),
    ).toBe('123456');
    expect(() =>
      service.decryptPassword(
        key.keyId,
        encrypted.encryptedKey,
        encrypted.iv,
        encrypted.encryptedPassword,
      ),
    ).toThrow(
      '登录请求已失效',
    );
  });

  it('rejects expired payloads and stale keys', () => {
    const service = new LoginCryptoService();
    const key = service.getPublicKey();
    const encrypted = encrypt(key.publicKey, {
      nonce: randomUUID(),
      password: '123456',
      timestamp: Date.now() - 3 * 60 * 1000,
    });

    expect(() =>
      service.decryptPassword(
        randomUUID(),
        encrypted.encryptedKey,
        encrypted.iv,
        encrypted.encryptedPassword,
      ),
    ).toThrow(
      '登录加密密钥已失效',
    );
    expect(() =>
      service.decryptPassword(
        key.keyId,
        encrypted.encryptedKey,
        encrypted.iv,
        encrypted.encryptedPassword,
      ),
    ).toThrow(
      '登录请求已失效',
    );
  });
});
