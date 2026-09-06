import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { RecordStatus } from '../../generated/prisma/enums.js';

export class CreateVariantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sku!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  diameterMm?: number;

  @IsInt()
  @Min(0)
  unitPriceCents!: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  lowStockThreshold?: number;

  @IsEnum(RecordStatus)
  @IsOptional()
  status?: RecordStatus;
}

export class CreateProductDto {
  @IsInt()
  @Min(1)
  categoryId!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(140)
  slug!: string;

  @IsString() @MaxLength(80) @IsOptional() mineralType?: string;
  @IsString() @MaxLength(80) @IsOptional() color?: string;
  @IsString() @MaxLength(120) @IsOptional() origin?: string;
  @IsString() @MaxLength(255) @IsOptional() shortMeaning?: string;
  @IsString() @IsOptional() description?: string;
  @IsUrl({ require_tld: false }) @MaxLength(500) @IsOptional() coverUrl?: string;
  @IsInt() @IsOptional() sort?: number;
  @IsEnum(RecordStatus) @IsOptional() status?: RecordStatus;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  @IsOptional()
  variants?: CreateVariantDto[];
}

export class UpdateProductDto {
  @IsInt() @Min(1) @IsOptional() categoryId?: number;
  @IsString() @IsNotEmpty() @MaxLength(120) @IsOptional() name?: string;
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(140) @IsOptional() slug?: string;
  @IsString() @MaxLength(80) @IsOptional() mineralType?: string;
  @IsString() @MaxLength(80) @IsOptional() color?: string;
  @IsString() @MaxLength(120) @IsOptional() origin?: string;
  @IsString() @MaxLength(255) @IsOptional() shortMeaning?: string;
  @IsString() @IsOptional() description?: string;
  @IsUrl({ require_tld: false }) @MaxLength(500) @IsOptional() coverUrl?: string;
  @IsInt() @IsOptional() sort?: number;
  @IsEnum(RecordStatus) @IsOptional() status?: RecordStatus;
}

export class UpdateVariantDto {
  @IsString() @IsNotEmpty() @MaxLength(100) @IsOptional() label?: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @IsOptional() diameterMm?: number;
  @IsInt() @Min(0) @IsOptional() unitPriceCents?: number;
  @IsInt() @Min(0) @IsOptional() lowStockThreshold?: number;
  @IsEnum(RecordStatus) @IsOptional() status?: RecordStatus;
}
