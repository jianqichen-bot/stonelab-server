import { BadRequestException, Injectable } from '@nestjs/common';
import {
  constants,
  createDecipheriv,
  generateKeyPairSync,
  privateDecrypt,
  randomUUID,
} from 'node:crypto';

const LOGIN_PAYLOAD_TTL_MS = 2 * 60 * 1000;

type EncryptedLoginPayload = {
  nonce: string;
  password: string;
  timestamp: number;
};

@Injectable()
export class LoginCryptoService {
  private readonly keyId = randomUUID();
  private readonly privateKey: string;
  private readonly publicKey: string;
  private readonly usedNonces = new Map<string, number>();

  constructor() {
    const keyPair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicExponent: 0x10_001,
      privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
      publicKeyEncoding: { format: 'pem', type: 'spki' },
    });
    this.privateKey = keyPair.privateKey;
    this.publicKey = keyPair.publicKey;
  }

  getPublicKey() {
    return {
      algorithm: 'RSA-OAEP-256',
      keyId: this.keyId,
      publicKey: this.publicKey,
    };
  }

  decryptPassword(
    keyId: string,
    encryptedKey: string,
    iv: string,
    encryptedPassword: string,
  ): string {
    if (keyId !== this.keyId) {
      throw new BadRequestException('登录加密密钥已失效，请重新登录');
    }

    let payload: EncryptedLoginPayload;
    try {
      const aesKey = privateDecrypt(
        {
          key: this.privateKey,
          oaepHash: 'sha256',
          padding: constants.RSA_PKCS1_OAEP_PADDING,
        },
        Buffer.from(encryptedKey, 'base64'),
      );
      const encrypted = Buffer.from(encryptedPassword, 'base64');
      const authTag = encrypted.subarray(encrypted.length - 16);
      const ciphertext = encrypted.subarray(0, encrypted.length - 16);
      const decipher = createDecipheriv('aes-256-gcm', aesKey, Buffer.from(iv, 'base64'));
      decipher.setAuthTag(authTag);
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString('utf8');
      payload = JSON.parse(plaintext) as EncryptedLoginPayload;
    } catch {
      throw new BadRequestException('登录密码解密失败，请刷新后重试');
    }

    const now = Date.now();
    this.removeExpiredNonces(now);
    if (
      typeof payload.timestamp !== 'number' ||
      Math.abs(now - payload.timestamp) > LOGIN_PAYLOAD_TTL_MS ||
      typeof payload.nonce !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(payload.nonce) ||
      typeof payload.password !== 'string' ||
      payload.password.length === 0 ||
      payload.password.length > 128 ||
      this.usedNonces.has(payload.nonce)
    ) {
      throw new BadRequestException('登录请求已失效，请重新登录');
    }

    this.usedNonces.set(payload.nonce, now + LOGIN_PAYLOAD_TTL_MS);
    return payload.password;
  }

  private removeExpiredNonces(now: number) {
    for (const [nonce, expiresAt] of this.usedNonces) {
      if (expiresAt <= now) this.usedNonces.delete(nonce);
    }
  }
}
