import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { BeadShape, RecordStatus } from '../../generated/prisma/enums.js';

export class CreateVariantDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  diameterMm!: number;

  @IsInt()
  @Min(0)
  unitPriceCents!: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  stock?: number;

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

  @IsString() @MaxLength(80) @IsOptional() mineralType?: string;
  @IsString() @MaxLength(80) @IsOptional() color?: string;
  @IsString() @MaxLength(120) @IsOptional() origin?: string;
  @IsString() @MaxLength(255) @IsOptional() shortMeaning?: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsNotEmpty() @MaxLength(500) imageKey!: string;
  @IsEnum(BeadShape) @IsOptional() shape?: BeadShape;
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
  @IsString() @MaxLength(80) @IsOptional() mineralType?: string;
  @IsString() @MaxLength(80) @IsOptional() color?: string;
  @IsString() @MaxLength(120) @IsOptional() origin?: string;
  @IsString() @MaxLength(255) @IsOptional() shortMeaning?: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsNotEmpty() @MaxLength(500) @IsOptional() imageKey?: string;
  @IsEnum(BeadShape) @IsOptional() shape?: BeadShape;
  @IsInt() @IsOptional() sort?: number;
  @IsEnum(RecordStatus) @IsOptional() status?: RecordStatus;
}

export class UpdateVariantDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @IsOptional() diameterMm?: number;
  @IsInt() @Min(0) @IsOptional() unitPriceCents?: number;
  @IsEnum(RecordStatus) @IsOptional() status?: RecordStatus;
}
