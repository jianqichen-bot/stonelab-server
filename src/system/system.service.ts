import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { OssAssetService } from '../storage/oss-asset.service.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import type {
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

type TreeItem = {
  id: number;
  parentId: number | null;
  sort: number;
  children?: TreeItem[];
};

@Injectable()
export class SystemService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OssAssetService) private readonly assets: OssAssetService,
  ) {}

  async listDepartments() {
    const rows = await this.prisma.adminDepartment.findMany({
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });
    return this.toTree(
      rows.map((row) => ({
        id: row.id,
        parentId: row.parentId,
        name: row.name,
        sort: row.sort,
        status: row.status,
        remark: row.remark,
        createdAt: row.createdAt.toISOString(),
      })),
    );
  }

  async createDepartment(input: CreateDepartmentDto) {
    if (input.parentId) await this.requireDepartment(input.parentId);
    return this.prisma.adminDepartment.create({ data: input });
  }

  async updateDepartment(id: number, input: UpdateDepartmentDto) {
    await this.requireDepartment(id);
    if (input.parentId === id) throw new BadRequestException('上级部门不能选择自身');
    if (input.parentId) {
      await this.requireDepartment(input.parentId);
      await this.ensureDepartmentParentIsNotDescendant(id, input.parentId);
    }
    return this.prisma.adminDepartment.update({ where: { id }, data: input });
  }

  async deleteDepartment(id: number) {
    await this.requireDepartment(id);
    const [childCount, userCount] = await Promise.all([
      this.prisma.adminDepartment.count({ where: { parentId: id } }),
      this.prisma.adminUser.count({ where: { departmentId: id } }),
    ]);
    if (childCount) throw new ConflictException('请先删除下级部门');
    if (userCount) throw new ConflictException('该部门下仍有用户，不能删除');
    await this.prisma.adminDepartment.delete({ where: { id } });
  }

  async listMenus() {
    const rows = await this.prisma.adminMenu.findMany({
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });
    return this.toTree(
      rows.map((row) => ({
        id: row.id,
        parentId: row.parentId,
        name: row.name,
        nameEn: row.nameEn,
        type: row.type,
        path: row.path,
        component: row.component,
        permission: row.permission,
        icon: row.icon,
        sort: row.sort,
        status: row.status,
      })),
    );
  }

  async createMenu(input: CreateMenuDto) {
    this.validateMenu(input);
    if (input.parentId) await this.requireMenu(input.parentId);
    return this.prisma.adminMenu.create({ data: input });
  }

  async updateMenu(id: number, input: UpdateMenuDto) {
    const current = await this.requireMenu(id);
    const next = { ...current, ...input };
    this.validateMenu(next);
    if (input.parentId === id) throw new BadRequestException('上级菜单不能选择自身');
    if (input.parentId) {
      await this.requireMenu(input.parentId);
      await this.ensureMenuParentIsNotDescendant(id, input.parentId);
    }
    return this.prisma.adminMenu.update({ where: { id }, data: input });
  }

  async deleteMenu(id: number) {
    await this.requireMenu(id);
    const childCount = await this.prisma.adminMenu.count({ where: { parentId: id } });
    if (childCount) throw new ConflictException('请先删除下级菜单或权限');
    await this.prisma.adminMenu.delete({ where: { id } });
  }

  async listRoles() {
    const rows = await this.prisma.adminRole.findMany({
      include: { menus: { select: { id: true } } },
      orderBy: { id: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      permissionIds: row.menus.map((menu) => menu.id),
      status: row.status,
      remark: row.remark,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async createRole(input: CreateRoleDto) {
    await this.requireMenuIds(input.permissionIds);
    if (await this.prisma.adminRole.findUnique({ where: { code: input.code } })) {
      throw new ConflictException('角色标识已存在');
    }
    if (await this.prisma.adminRole.findUnique({ where: { name: input.name } })) {
      throw new ConflictException('角色名称已存在');
    }
    const { permissionIds, ...data } = input;
    return this.prisma.adminRole.create({
      data: {
        ...data,
        menus: { connect: permissionIds.map((id) => ({ id })) },
      },
    });
  }

  async updateRole(id: number, input: UpdateRoleDto) {
    await this.requireRole(id);
    if (id === 1 && input.status === 'DISABLED') {
      throw new ForbiddenException('不能停用超级管理员角色');
    }
    if (input.name) {
      const duplicate = await this.prisma.adminRole.findFirst({
        where: { name: input.name, NOT: { id } },
      });
      if (duplicate) throw new ConflictException('角色名称已存在');
    }
    if (input.permissionIds) await this.requireMenuIds(input.permissionIds);
    const { permissionIds, ...data } = input;
    return this.prisma.adminRole.update({
      where: { id },
      data: {
        ...data,
        ...(permissionIds
          ? { menus: { set: permissionIds.map((menuId) => ({ id: menuId })) } }
          : {}),
      },
    });
  }

  async deleteRole(id: number) {
    if (id === 1) throw new ForbiddenException('不能删除超级管理员角色');
    await this.requireRole(id);
    const userCount = await this.prisma.adminUser.count({
      where: { roleRecords: { some: { id } } },
    });
    if (userCount) throw new ConflictException('该角色仍分配给用户，不能删除');
    await this.prisma.adminRole.delete({ where: { id } });
  }

  async listUsers() {
    const rows = await this.prisma.adminUser.findMany({
      include: { roleRecords: { select: { id: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toUser(row));
  }

  async createUser(input: CreateUserDto) {
    await this.requireDepartment(input.departmentId);
    await this.requireRoleIds(input.roleIds);
    if (await this.prisma.adminUser.findUnique({ where: { username: input.username } })) {
      throw new ConflictException('登录账号已存在');
    }
    const { password, roleIds, name, ...data } = input;
    const row = await this.prisma.adminUser.create({
      data: {
        ...data,
        realName: name,
        passwordHash: await hashPassword(password),
        roleRecords: { connect: roleIds.map((id) => ({ id })) },
      },
      include: { roleRecords: { select: { id: true } } },
    });
    return this.toUser(row);
  }

  async updateUser(id: string, input: UpdateUserDto) {
    const current = await this.requireUser(id);
    if (current.username === 'admin' && input.status === 'DISABLED') {
      throw new ForbiddenException('不能停用初始管理员');
    }
    if (input.username && input.username !== current.username) {
      const duplicate = await this.prisma.adminUser.findUnique({
        where: { username: input.username },
      });
      if (duplicate) throw new ConflictException('登录账号已存在');
    }
    if (input.departmentId) await this.requireDepartment(input.departmentId);
    if (input.roleIds) await this.requireRoleIds(input.roleIds);
    const { password, roleIds, name, ...data } = input;
    const row = await this.prisma.adminUser.update({
      where: { id },
      data: {
        ...data,
        ...(name === undefined ? {} : { realName: name }),
        ...(password ? { passwordHash: await hashPassword(password) } : {}),
        ...(roleIds ? { roleRecords: { set: roleIds.map((roleId) => ({ id: roleId })) } } : {}),
      },
      include: { roleRecords: { select: { id: true } } },
    });
    return this.toUser(row);
  }

  async deleteUser(id: string, currentUserId: string) {
    if (id === currentUserId) throw new ForbiddenException('不能删除当前登录用户');
    const user = await this.requireUser(id);
    if (user.username === 'admin') throw new ForbiddenException('不能删除初始管理员');
    await this.prisma.adminUser.delete({ where: { id } });
  }

  async updateProfile(userId: string, input: UpdateProfileDto) {
    const row = await this.prisma.adminUser.update({
      where: { id: userId },
      data: input,
      include: { roleRecords: { select: { id: true } } },
    });
    return this.toUser(row);
  }

  async updateAvatar(userId: string, originalName: string, mimeType: string, content: Buffer) {
    const user = await this.requireUser(userId);
    const uploaded = await this.assets.uploadProfileAvatar(userId, originalName, mimeType, content);
    try {
      await this.prisma.adminUser.update({
        where: { id: userId },
        data: { avatarKey: uploaded.key },
      });
    } catch (error) {
      await this.assets.deleteObject(uploaded.key).catch(() => undefined);
      throw error;
    }
    if (user.avatarKey) {
      await this.assets.deleteObject(user.avatarKey).catch(() => undefined);
    }
    return { avatar: uploaded.url };
  }

  async changePassword(userId: string, input: ChangePasswordDto) {
    const user = await this.requireUser(userId);
    if (!(await verifyPassword(input.oldPassword, user.passwordHash))) {
      throw new UnauthorizedException('旧密码不正确');
    }
    await this.prisma.adminUser.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(input.newPassword) },
    });
  }

  private toUser(row: {
    id: string;
    username: string;
    realName: string;
    departmentId: number | null;
    phone: string | null;
    email: string | null;
    status: string;
    createdAt: Date;
    roleRecords: { id: number }[];
  }) {
    return {
      id: row.id,
      username: row.username,
      name: row.realName,
      departmentId: row.departmentId,
      roleIds: row.roleRecords.map((role) => role.id),
      phone: row.phone ?? '',
      email: row.email ?? '',
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toTree<T extends TreeItem>(items: T[]): T[] {
    const byParent = new Map<number | null, T[]>();
    for (const item of items) {
      const siblings = byParent.get(item.parentId) ?? [];
      siblings.push(item);
      byParent.set(item.parentId, siblings);
    }
    const append = (item: T): T => {
      const children = byParent.get(item.id)?.map(append);
      return children?.length ? { ...item, children } : item;
    };
    return (byParent.get(null) ?? []).map(append);
  }

  private validateMenu(input: { component: string; path: string; type: string }) {
    if (input.type !== 'BUTTON' && !input.path.trim()) {
      throw new BadRequestException('目录和菜单必须填写路由地址');
    }
    if (input.type === 'MENU' && !input.component.trim()) {
      throw new BadRequestException('页面菜单必须填写组件路径');
    }
  }

  private async requireDepartment(id: number) {
    const row = await this.prisma.adminDepartment.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('部门不存在');
    return row;
  }

  private async requireMenu(id: number) {
    const row = await this.prisma.adminMenu.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('菜单不存在');
    return row;
  }

  private async requireRole(id: number) {
    const row = await this.prisma.adminRole.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('角色不存在');
    return row;
  }

  private async requireUser(id: string) {
    const row = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('用户不存在');
    return row;
  }

  private async requireMenuIds(ids: number[]) {
    const uniqueIds = [...new Set(ids)];
    const count = await this.prisma.adminMenu.count({ where: { id: { in: uniqueIds } } });
    if (count !== uniqueIds.length) throw new BadRequestException('包含不存在的菜单权限');
  }

  private async requireRoleIds(ids: number[]) {
    const uniqueIds = [...new Set(ids)];
    const count = await this.prisma.adminRole.count({
      where: { id: { in: uniqueIds }, status: 'ENABLED' },
    });
    if (count !== uniqueIds.length) throw new BadRequestException('包含不存在或已停用的角色');
  }

  private async ensureDepartmentParentIsNotDescendant(id: number, parentId: number) {
    let cursor: number | null = parentId;
    while (cursor) {
      if (cursor === id) throw new BadRequestException('不能将部门移动到自己的下级');
      const parent: { parentId: number | null } | null =
        await this.prisma.adminDepartment.findUnique({
          where: { id: cursor },
          select: { parentId: true },
        });
      cursor = parent?.parentId ?? null;
    }
  }

  private async ensureMenuParentIsNotDescendant(id: number, parentId: number) {
    let cursor: number | null = parentId;
    while (cursor) {
      if (cursor === id) throw new BadRequestException('不能将菜单移动到自己的下级');
      const parent: { parentId: number | null } | null = await this.prisma.adminMenu.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = parent?.parentId ?? null;
    }
  }
}
