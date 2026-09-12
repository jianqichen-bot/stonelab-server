import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '../config/config.service.js';
import { OssAssetService } from './oss-asset.service.js';

describe('OssAssetService', () => {
  it('lists image objects from the beads directory with signed URLs', async () => {
    const listV2 = vi.fn().mockResolvedValue({
      objects: [
        {
          lastModified: '2026-09-12T12:00:00.000Z',
          name: 'beads/crystal.png',
          size: 1234,
        },
        { lastModified: '', name: 'beads/readme.txt', size: 10 },
      ],
    });
    const signatureUrl = vi.fn((key: string) => `signed:${key}`);
    const service = createService({ listV2, signatureUrl });

    await expect(service.listBeadImages()).resolves.toEqual([
      {
        key: 'beads/crystal.png',
        name: 'crystal.png',
        size: 1234,
        updatedAt: '2026-09-12T12:00:00.000Z',
        url: 'signed:beads/crystal.png',
      },
    ]);
  });

  it('uploads supported images under a generated beads key', async () => {
    const put = vi.fn().mockResolvedValue({});
    const service = createService({
      put,
      signatureUrl: (key: string) => `signed:${key}`,
    });

    const result = await service.uploadBeadImage('crystal.png', 'image/png', Buffer.from('image'));

    expect(result.key).toMatch(/^beads\/[0-9a-f-]+\.png$/);
    expect(result.url).toBe(`signed:${result.key}`);
    expect(put).toHaveBeenCalledWith(result.key, expect.any(Buffer), {
      headers: { 'Content-Type': 'image/png' },
    });
  });

  it('rejects non-image uploads', async () => {
    const service = createService({});
    await expect(
      service.uploadBeadImage('note.txt', 'text/plain', Buffer.from('text')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

function createService(client: object) {
  const service = new OssAssetService({
    get: () => 3600,
  } as unknown as ConfigService);
  Object.assign(service, { client });
  return service;
}
