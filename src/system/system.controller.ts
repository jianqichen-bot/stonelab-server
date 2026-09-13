import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import type { RequestUser } from '../auth/auth.types.js';
import type { FastifyRequest } from 'fastify';
import {
  ChangePasswordDto,
  CreateDepartmentDto,
  CreateMenuDto,
  CreateRoleDto,
  CreateUserDto,
  UpdateDepartmentDto,
  UpdateMenuDto,
  UpdateProfileDto,
  UpdateRoleDto,
  UpdateUserDto,
} from './dto/system.dto.js';
import { SystemService } from './system.service.js';

@ApiTags('admin-system')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller({ path: 'admin/system', version: VERSION_NEUTRAL })
export class SystemController {
  constructor(@Inject(SystemService) private readonly system: SystemService) {}

  @Get('departments')
  @RequirePermissions('system:department:list')
  listDepartments() {
    return this.system.listDepartments();
  }

  @Post('departments')
  @RequirePermissions('system:department:create')
  createDepartment(@Body() input: CreateDepartmentDto) {
    return this.system.createDepartment(input);
  }

  @Patch('departments/:id')
  @RequirePermissions('system:department:update')
  updateDepartment(@Param('id', ParseIntPipe) id: number, @Body() input: UpdateDepartmentDto) {
    return this.system.updateDepartment(id, input);
  }

  @Delete('departments/:id')
  @RequirePermissions('system:department:delete')
  deleteDepartment(@Param('id', ParseIntPipe) id: number) {
    return this.system.deleteDepartment(id);
  }

  @Get('menus')
  @RequirePermissions('system:menu:list')
  listMenus() {
    return this.system.listMenus();
  }

  @Post('menus')
  @RequirePermissions('system:menu:create')
  createMenu(@Body() input: CreateMenuDto) {
    return this.system.createMenu(input);
  }

  @Patch('menus/:id')
  @RequirePermissions('system:menu:update')
  updateMenu(@Param('id', ParseIntPipe) id: number, @Body() input: UpdateMenuDto) {
    return this.system.updateMenu(id, input);
  }

  @Delete('menus/:id')
  @RequirePermissions('system:menu:delete')
  deleteMenu(@Param('id', ParseIntPipe) id: number) {
    return this.system.deleteMenu(id);
  }

  @Get('roles')
  @RequirePermissions('system:role:list')
  listRoles() {
    return this.system.listRoles();
  }

  @Post('roles')
  @RequirePermissions('system:role:create')
  createRole(@Body() input: CreateRoleDto) {
    return this.system.createRole(input);
  }

  @Patch('roles/:id')
  @RequirePermissions('system:role:update')
  updateRole(@Param('id', ParseIntPipe) id: number, @Body() input: UpdateRoleDto) {
    return this.system.updateRole(id, input);
  }

  @Delete('roles/:id')
  @RequirePermissions('system:role:delete')
  deleteRole(@Param('id', ParseIntPipe) id: number) {
    return this.system.deleteRole(id);
  }

  @Get('users')
  @RequirePermissions('system:user:list')
  listUsers() {
    return this.system.listUsers();
  }

  @Post('users')
  @RequirePermissions('system:user:create')
  createUser(@Body() input: CreateUserDto) {
    return this.system.createUser(input);
  }

  @Patch('users/:id')
  @RequirePermissions('system:user:update')
  updateUser(@Param('id') id: string, @Body() input: UpdateUserDto) {
    return this.system.updateUser(id, input);
  }

  @Delete('users/:id')
  @RequirePermissions('system:user:delete')
  deleteUser(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.system.deleteUser(id, user.sub);
  }
}

@ApiTags('admin-profile')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'user', version: VERSION_NEUTRAL })
export class ProfileController {
  constructor(@Inject(SystemService) private readonly system: SystemService) {}

  @Patch('profile')
  updateProfile(@CurrentUser() user: RequestUser, @Body() input: UpdateProfileDto) {
    return this.system.updateProfile(user.sub, input);
  }

  @Post('avatar')
  async updateAvatar(@CurrentUser() user: RequestUser, @Req() request: FastifyRequest) {
    const file = await request.file();
    if (!file) throw new BadRequestException('请选择头像图片');
    return this.system.updateAvatar(user.sub, file.filename, file.mimetype, await file.toBuffer());
  }

  @Patch('password')
  changePassword(@CurrentUser() user: RequestUser, @Body() input: ChangePasswordDto) {
    return this.system.changePassword(user.sub, input);
  }
}
