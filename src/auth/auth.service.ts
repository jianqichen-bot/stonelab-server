import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { RecordStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginDto } from './dto/login.dto.js';
import { verifyPassword } from './password.js';
import { TokenService } from './token.service.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TokenService) private readonly tokens: TokenService,
  ) {}

  async login(input: LoginDto) {
    const user = await this.prisma.adminUser.findUnique({ where: { username: input.username } });
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
      roles: user.roles,
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.tokens.verifyRefresh(refreshToken);
      const user = await this.prisma.adminUser.findUnique({ where: { id: payload.sub } });
      if (!user || user.status !== RecordStatus.ENABLED) throw new Error('user disabled');
      return (await this.issueTokens(user)).accessToken;
    } catch {
      throw new UnauthorizedException('刷新令牌无效或已过期');
    }
  }

  async getUserInfo(userId: string) {
    const user = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: userId } });
    return {
      id: user.id,
      username: user.username,
      realName: user.realName,
      roles: user.roles,
      homePath: '/dashboard',
    };
  }

  async getCodes(userId: string) {
    const user = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: userId } });
    return user.permissions.length
      ? user.permissions
      : ['catalog:read', 'catalog:write', 'inventory:read', 'inventory:write'];
  }

  getMenus() {
    return [
      {
        path: '/dashboard',
        name: 'Dashboard',
        meta: { icon: 'lucide:layout-dashboard', order: -1, title: 'page.dashboard.title' },
        children: [
          {
            path: '',
            name: 'DashboardOverview',
            component: '/dashboard/index',
            meta: { affixTab: true, title: 'page.dashboard.overview' },
          },
        ],
      },
      {
        path: '/catalog',
        name: 'Catalog',
        meta: { icon: 'lucide:gem', order: 10, title: '商品中心' },
        children: [
          {
            path: 'categories',
            name: 'CatalogCategories',
            component: '/catalog/categories/index',
            meta: { title: '分类管理' },
          },
          {
            path: 'products',
            name: 'CatalogProducts',
            component: '/catalog/products/index',
            meta: { title: '珠子商品' },
          },
        ],
      },
    ];
  }

  private async issueTokens(user: { id: string; username: string; roles: string[] }) {
    return this.tokens.issue(user);
  }
}
