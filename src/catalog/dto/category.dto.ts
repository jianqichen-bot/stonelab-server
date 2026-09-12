import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { RecordStatus } from '../../generated/prisma/enums.js';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsInt()
  @Min(1)
  @IsOptional()
  parentId?: number;

  @IsInt()
  @IsOptional()
  sort?: number;

  @IsEnum(RecordStatus)
  @IsOptional()
  status?: RecordStatus;
}

export class UpdateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  parentId?: number;

  @IsInt()
  @IsOptional()
  sort?: number;

  @IsEnum(RecordStatus)
  @IsOptional()
  status?: RecordStatus;
}
