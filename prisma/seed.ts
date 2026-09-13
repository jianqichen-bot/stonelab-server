import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/auth/password.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const username = process.env.ADMIN_INITIAL_USERNAME ?? 'admin';
const password = process.env.ADMIN_INITIAL_PASSWORD;
const realName = process.env.ADMIN_INITIAL_NAME ?? 'StoneLab 管理员';
if (!password) throw new Error('ADMIN_INITIAL_PASSWORD is required for seeding');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

async function main() {
  const passwordHash = await hashPassword(password!);
  const departments = [
    { id: 1, name: 'StoneLab', parentId: null, sort: 1, remark: '总部' },
    { id: 2, name: '产品部', parentId: 1, sort: 1, remark: '负责商品与分类维护' },
    { id: 3, name: '运营部', parentId: 1, sort: 2, remark: '负责小程序日常运营' },
  ];
  for (const department of departments) {
    await prisma.adminDepartment.upsert({
      where: { id: department.id },
      create: department,
      update: department,
    });
  }

  const menus = [
    {
      id: 10,
      parentId: null,
      name: '商品中心',
      i18nKey: 'catalog.title',
      type: 'DIRECTORY',
      path: '/catalog',
      icon: 'lucide:gem',
      sort: 10,
    },
    {
      id: 11,
      parentId: 10,
      name: '分类管理',
      i18nKey: 'catalog.category.title',
      type: 'MENU',
      path: '/catalog/categories',
      component: '/catalog/categories/index',
      permission: 'catalog:category:list',
      sort: 1,
    },
    {
      id: 12,
      parentId: 10,
      name: '珠子商品',
      i18nKey: 'catalog.product.title',
      type: 'MENU',
      path: '/catalog/products',
      component: '/catalog/products/index',
      permission: 'catalog:product:list',
      sort: 2,
    },
    {
      id: 20,
      parentId: null,
      name: '系统管理',
      i18nKey: 'system.title',
      type: 'DIRECTORY',
      path: '/system',
      icon: 'lucide:settings',
      sort: 20,
    },
    {
      id: 21,
      parentId: 20,
      name: '菜单管理',
      i18nKey: 'system.menu.title',
      type: 'MENU',
      path: '/system/menus',
      component: '/system/menus/index',
      permission: 'system:menu:list',
      sort: 1,
    },
    {
      id: 22,
      parentId: 20,
      name: '用户管理',
      i18nKey: 'system.user.title',
      type: 'MENU',
      path: '/system/users',
      component: '/system/users/index',
      permission: 'system:user:list',
      sort: 2,
    },
    {
      id: 23,
      parentId: 20,
      name: '角色管理',
      i18nKey: 'system.role.title',
      type: 'MENU',
      path: '/system/roles',
      component: '/system/roles/index',
      permission: 'system:role:list',
      sort: 3,
    },
    {
      id: 24,
      parentId: 20,
      name: '部门管理',
      i18nKey: 'system.department.title',
      type: 'MENU',
      path: '/system/departments',
      component: '/system/departments/index',
      permission: 'system:department:list',
      sort: 4,
    },
    {
      id: 211,
      parentId: 21,
      name: '新建菜单',
      type: 'BUTTON',
      permission: 'system:menu:create',
      sort: 1,
    },
    {
      id: 212,
      parentId: 21,
      name: '编辑菜单',
      type: 'BUTTON',
      permission: 'system:menu:update',
      sort: 2,
    },
    {
      id: 213,
      parentId: 21,
      name: '删除菜单',
      type: 'BUTTON',
      permission: 'system:menu:delete',
      sort: 3,
    },
    {
      id: 221,
      parentId: 22,
      name: '新建用户',
      type: 'BUTTON',
      permission: 'system:user:create',
      sort: 1,
    },
    {
      id: 222,
      parentId: 22,
      name: '编辑用户',
      type: 'BUTTON',
      permission: 'system:user:update',
      sort: 2,
    },
    {
      id: 223,
      parentId: 22,
      name: '删除用户',
      type: 'BUTTON',
      permission: 'system:user:delete',
      sort: 3,
    },
    {
      id: 231,
      parentId: 23,
      name: '新建角色',
      type: 'BUTTON',
      permission: 'system:role:create',
      sort: 1,
    },
    {
      id: 232,
      parentId: 23,
      name: '编辑角色',
      type: 'BUTTON',
      permission: 'system:role:update',
      sort: 2,
    },
    {
      id: 233,
      parentId: 23,
      name: '删除角色',
      type: 'BUTTON',
      permission: 'system:role:delete',
      sort: 3,
    },
    {
      id: 241,
      parentId: 24,
      name: '新建部门',
      type: 'BUTTON',
      permission: 'system:department:create',
      sort: 1,
    },
    {
      id: 242,
      parentId: 24,
      name: '编辑部门',
      type: 'BUTTON',
      permission: 'system:department:update',
      sort: 2,
    },
    {
      id: 243,
      parentId: 24,
      name: '删除部门',
      type: 'BUTTON',
      permission: 'system:department:delete',
      sort: 3,
    },
  ];
  for (const menu of menus) {
    await prisma.adminMenu.upsert({
      where: { id: menu.id },
      create: menu,
      update: menu,
    });
  }

  const adminRole = await prisma.adminRole.upsert({
    where: { code: 'super_admin' },
    create: {
      code: 'super_admin',
      name: '超级管理员',
      remark: '拥有全部后台权限',
      menus: { connect: menus.map(({ id }) => ({ id })) },
    },
    update: {
      name: '超级管理员',
      remark: '拥有全部后台权限',
      menus: { set: menus.map(({ id }) => ({ id })) },
    },
  });
  await prisma.adminUser.upsert({
    where: { username },
    create: {
      username,
      passwordHash,
      realName,
      departmentId: 1,
      roleRecords: { connect: { id: adminRole.id } },
    },
    update: {
      passwordHash,
      realName,
      departmentId: 1,
      roleRecords: { set: { id: adminRole.id } },
    },
  });
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
