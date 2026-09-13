import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { RecordStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OssAssetService } from '../storage/oss-asset.service.js';
import type { LoginDto } from './dto/login.dto.js';
import { verifyPassword } from './password.js';
import { TokenService } from './token.service.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(OssAssetService) private readonly assets: OssAssetService,
  ) {}

  async login(input: LoginDto) {
    const user = await this.prisma.adminUser.findUnique({
      where: { username: input.username },
      include: { roleRecords: { where: { status: RecordStatus.ENABLED } } },
    });
    if (
      !user ||
      user.status !== RecordStatus.ENABLED ||
      !(await verifyPassword(input.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    await this.prisma.adminUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    const tokens = await this.issueTokens(user);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      username: user.username,
      realName: user.realName,
      roles: user.roleRecords.map((role) => role.code),
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.tokens.verifyRefresh(refreshToken);
      const user = await this.prisma.adminUser.findUnique({
        where: { id: payload.sub },
        include: { roleRecords: { where: { status: RecordStatus.ENABLED } } },
      });
      if (!user || user.status !== RecordStatus.ENABLED) throw new Error('user disabled');
      return (await this.issueTokens(user)).accessToken;
    } catch {
      throw new UnauthorizedException('刷新令牌无效或已过期');
    }
  }

  async getUserInfo(userId: string) {
    const user = await this.prisma.adminUser.findUniqueOrThrow({
      where: { id: userId },
      include: {
        department: { select: { id: true, name: true } },
        roleRecords: { where: { status: RecordStatus.ENABLED } },
      },
    });
    return {
      id: user.id,
      username: user.username,
      realName: user.realName,
      phone: user.phone ?? '',
      email: user.email ?? '',
      avatar: user.avatarKey ? this.assets.signedUrl(user.avatarKey) : '',
      department: user.department,
      roles: user.roleRecords.map((role) => role.code),
      homePath: '/home',
    };
  }

  async getCodes(userId: string) {
    const user = await this.prisma.adminUser.findUniqueOrThrow({
      where: { id: userId },
      select: {
        legacyPermissions: true,
        roleRecords: {
          where: { status: RecordStatus.ENABLED },
          select: {
            menus: {
              where: { status: RecordStatus.ENABLED },
              select: { permission: true },
            },
          },
        },
      },
    });
    return [
      ...new Set([
        ...user.legacyPermissions,
        ...user.roleRecords.flatMap((role) =>
          role.menus.map((menu) => menu.permission).filter(Boolean),
        ),
      ]),
    ];
  }

  async getMenus(userId: string) {
    const [user, allMenus] = await Promise.all([
      this.prisma.adminUser.findUniqueOrThrow({
        where: { id: userId },
        select: {
          roleRecords: {
            where: { status: RecordStatus.ENABLED },
            select: {
              menus: {
                where: { status: RecordStatus.ENABLED },
                select: { id: true },
              },
            },
          },
        },
      }),
      this.prisma.adminMenu.findMany({
        where: { status: RecordStatus.ENABLED },
        orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      }),
    ]);
    const byId = new Map(allMenus.map((menu) => [menu.id, menu]));
    const allowed = new Set(user.roleRecords.flatMap((role) => role.menus.map((menu) => menu.id)));
    for (const id of [...allowed]) {
      let parentId = byId.get(id)?.parentId;
      while (parentId) {
        allowed.add(parentId);
        parentId = byId.get(parentId)?.parentId;
      }
    }
    const visible = allMenus.filter((menu) => allowed.has(menu.id) && menu.type !== 'BUTTON');
    const childrenByParent = new Map<number | null, typeof visible>();
    for (const menu of visible) {
      const siblings = childrenByParent.get(menu.parentId) ?? [];
      siblings.push(menu);
      childrenByParent.set(menu.parentId, siblings);
    }
    const toRoute = (menu: (typeof visible)[number], parentPath = ''): Record<string, unknown> => {
      const children = (childrenByParent.get(menu.id) ?? []).map((child) =>
        toRoute(child, menu.path),
      );
      const childPath =
        parentPath && menu.path.startsWith(`${parentPath}/`)
          ? menu.path.slice(parentPath.length + 1)
          : menu.path;
      return {
        path: childPath,
        name: this.routeName(menu.path),
        ...(menu.type === 'MENU' ? { component: menu.component } : {}),
        meta: {
          title: menu.i18nKey || menu.name,
          icon: menu.icon || undefined,
          order: menu.sort,
        },
        ...(children.length ? { children } : {}),
      };
    };
    return (childrenByParent.get(null) ?? []).map((menu) => toRoute(menu));
  }

  private routeName(path: string) {
    return path
      .split('/')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  private async issueTokens(user: {
    id: string;
    username: string;
    roleRecords: { code: string }[];
  }) {
    return this.tokens.issue({
      id: user.id,
      username: user.username,
      roles: user.roleRecords.map((role) => role.code),
    });
  }
}
