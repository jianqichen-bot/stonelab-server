import { OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { RecordStatus } from '../../generated/prisma/enums.js';

export enum AdminMenuType {
  BUTTON = 'BUTTON',
  DIRECTORY = 'DIRECTORY',
  MENU = 'MENU',
}

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  parentId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark = '';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort = 0;

  @IsOptional()
  @IsEnum(RecordStatus)
  status: RecordStatus = RecordStatus.ENABLED;
}

export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {}

export class CreateMenuDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nameEn!: string;

  @IsEnum(AdminMenuType)
  type!: AdminMenuType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  parentId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  path = '';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  component = '';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  permission = '';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  icon = '';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort = 0;

  @IsOptional()
  @IsEnum(RecordStatus)
  status: RecordStatus = RecordStatus.ENABLED;
}

export class UpdateMenuDto extends PartialType(CreateMenuDto) {}

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: '角色标识只能使用小写字母、数字和下划线，且必须以字母开头',
  })
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  permissionIds!: number[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark = '';

  @IsOptional()
  @IsEnum(RecordStatus)
  status: RecordStatus = RecordStatus.ENABLED;
}

export class UpdateRoleDto extends PartialType(OmitType(CreateRoleDto, ['code'] as const)) {}

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  username!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @Type(() => Number)
  @IsInt()
  departmentId!: number;

  @IsArray()
  @ArrayNotEmpty()
  @Type(() => Number)
  @IsInt({ each: true })
  roleIds!: number[];

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone = '';

  @IsOptional()
  @ValidateIf((_, value) => value !== '')
  @IsEmail()
  @MaxLength(100)
  email = '';

  @IsOptional()
  @IsEnum(RecordStatus)
  status: RecordStatus = RecordStatus.ENABLED;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}

export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  realName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone = '';

  @IsOptional()
  @ValidateIf((_, value) => value !== '')
  @IsEmail()
  @MaxLength(100)
  email = '';
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  oldPassword!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  newPassword!: string;
}
