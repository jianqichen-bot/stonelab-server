import { IsEnum, IsInt, IsOptional, IsString, MaxLength, NotEquals } from 'class-validator';
import { InventoryChangeType } from '../../generated/prisma/enums.js';

export class AdjustInventoryDto {
  @IsInt()
  @NotEquals(0)
  change!: number;

  @IsEnum(InventoryChangeType)
  type!: InventoryChangeType;

  @IsString()
  @MaxLength(255)
  @IsOptional()
  remark?: string;
}
