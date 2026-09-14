import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CartItemSource } from '../../generated/prisma/enums.js';

export enum PackageCode {
  STANDARD = 'STANDARD',
}

export enum CertificateCode {
  NONE = 'NONE',
}

export enum ShippingMethod {
  STANDARD = 'STANDARD',
  EXPRESS = 'EXPRESS',
}

export class CartMaterialDto {
  @IsInt()
  @Min(1)
  variantId!: number;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}

export class AddCartItemDto {
  @IsOptional()
  @IsEnum(CartItemSource)
  source = CartItemSource.DIY;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  previewImageKey?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(100)
  wristCircumferenceCm?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(100)
  recommendedWristMinCm?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(100)
  recommendedWristMaxCm?: number;

  @IsOptional()
  @IsEnum(PackageCode)
  packageCode = PackageCode.STANDARD;

  @IsOptional()
  @IsEnum(CertificateCode)
  certificateCode = CertificateCode.NONE;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CartMaterialDto)
  materials!: CartMaterialDto[];
}

export class UpdateCartItemDto {
  @IsOptional()
  @IsBoolean()
  selected?: boolean;

  @IsOptional()
  @IsEnum(PackageCode)
  packageCode?: PackageCode;

  @IsOptional()
  @IsEnum(CertificateCode)
  certificateCode?: CertificateCode;
}

export class UpdateCartSelectionDto {
  @IsBoolean()
  selected!: boolean;
}

export class CheckoutPreviewDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  itemIds!: string[];

  @IsEnum(ShippingMethod)
  shippingMethod!: ShippingMethod;
}
