import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import OSS from 'ali-oss';
import { ConfigService } from '../config/config.service.js';

export interface OssImageAsset {
  key: string;
  name: string;
  size: number;
  updatedAt: string;
  url: string;
}

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class OssAssetService {
  private client?: OSS;

  constructor(private readonly config: ConfigService) {}

  signedUrl(objectKey: string): string {
    return this.getClient().signatureUrl(objectKey.replace(/^\/+/, ''), {
      expires: this.config.get<number>('OSS_SIGNED_URL_EXPIRES_SECONDS', 3600),
      method: 'GET',
    });
  }

  async listBeadImages(): Promise<OssImageAsset[]> {
    const result = await this.getClient().listV2({ prefix: 'beads/', 'max-keys': 1000 }, {});

    return (result.objects ?? [])
      .filter((object) => /\.(?:gif|jpe?g|png|webp)$/i.test(object.name))
      .map((object) => ({
        key: object.name,
        name: object.name.slice('beads/'.length),
        size: object.size,
        updatedAt: object.lastModified,
        url: this.signedUrl(object.name),
      }));
  }

  async uploadBeadImage(
    originalName: string,
    mimeType: string,
    content: Buffer,
  ): Promise<OssImageAsset> {
    const extension = IMAGE_EXTENSIONS[mimeType];
    if (!extension) {
      throw new BadRequestException('仅支持 JPG、PNG、WebP 或 GIF 图片');
    }
    if (!content.length) throw new BadRequestException('图片文件不能为空');

    const key = `beads/${randomUUID()}.${extension}`;
    await this.getClient().put(key, content, {
      headers: { 'Content-Type': mimeType },
    });
    return {
      key,
      name: originalName,
      size: content.length,
      updatedAt: new Date().toISOString(),
      url: this.signedUrl(key),
    };
  }

  private getClient(): OSS {
    this.client ??= new OSS({
      accessKeyId: this.config.getOrThrow<string>('OSS_ACCESS_KEY_ID'),
      accessKeySecret: this.config.getOrThrow<string>('OSS_ACCESS_KEY_SECRET'),
      bucket: this.config.getOrThrow<string>('OSS_BUCKET'),
      endpoint: this.config.getOrThrow<string>('OSS_ENDPOINT'),
      region: this.config.getOrThrow<string>('OSS_REGION'),
      secure: true,
    });
    return this.client;
  }
}
