import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { OssAssetService } from '../storage/oss-asset.service.js';
import { AuthService } from './auth.service.js';
import type { TokenService } from './token.service.js';

describe('AuthService permissions and dynamic menus', () => {
  it('builds route trees from the current user enabled menus', async () => {
    const findUniqueOrThrow = vi.fn().mockResolvedValue({
      roleRecords: [{ menus: [{ id: 12 }, { id: 20 }, { id: 22 }, { id: 221 }] }],
    });
    const findMany = vi
      .fn()
      .mockResolvedValue([
        menu(10, null, '商品中心', 'DIRECTORY', '/catalog', 10),
        menu(12, 10, '珠子商品', 'MENU', '/catalog/products', 2, '/catalog/products/index'),
        menu(20, null, '系统管理', 'DIRECTORY', '/system', 20),
        menu(22, 20, '用户管理', 'MENU', '/system/users', 2, '/system/users/index'),
        { ...menu(221, 22, '新建用户', 'BUTTON', '', 1), permission: 'system:user:create' },
      ]);
    const service = createService({
      adminUser: { findUniqueOrThrow },
      adminMenu: { findMany },
    });

    const routes = await service.getMenus('user-1');

    expect(routes).toMatchObject([
      {
        name: 'Catalog',
        path: '/catalog',
        children: [
          {
            name: 'CatalogProducts',
            path: 'products',
            component: '/catalog/products/index',
          },
        ],
      },
      {
        name: 'System',
        path: '/system',
        children: [
          {
            name: 'SystemUsers',
            path: 'users',
            component: '/system/users/index',
          },
        ],
      },
    ]);
    expect(JSON.stringify(routes)).not.toContain('system:user:create');
  });

  it('deduplicates permissions from roles and legacy data', async () => {
    const service = createService({
      adminUser: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          legacyPermissions: ['catalog:product:list'],
          roleRecords: [
            {
              menus: [
                { permission: 'catalog:product:list' },
                { permission: 'system:user:list' },
                { permission: '' },
              ],
            },
          ],
        }),
      },
    });

    await expect(service.getCodes('user-1')).resolves.toEqual([
      'catalog:product:list',
      'system:user:list',
    ]);
  });
});

function menu(
  id: number,
  parentId: number | null,
  name: string,
  type: string,
  path: string,
  sort: number,
  component = '',
) {
  return {
    id,
    parentId,
    name,
    type,
    path,
    component,
    permission: '',
    icon: '',
    sort,
    status: 'ENABLED',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createService(prismaShape: object) {
  return new AuthService(
    prismaShape as PrismaService,
    {} as TokenService,
    { signedUrl: (key: string) => `signed:${key}` } as OssAssetService,
  );
}
