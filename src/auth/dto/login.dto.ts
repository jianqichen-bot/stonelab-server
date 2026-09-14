import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  username!: string;

  @ApiProperty({ description: 'AES-GCM 加密后的登录数据' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  encryptedPassword!: string;

  @ApiProperty({ description: '使用登录公钥加密后的 AES 密钥' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  encryptedKey!: string;

  @ApiProperty({ description: 'AES-GCM 初始化向量' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  iv!: string;

  @ApiProperty({ description: '登录加密公钥标识' })
  @IsUUID()
  keyId!: string;
}
