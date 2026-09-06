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
  await prisma.adminUser.upsert({
    where: { username },
    create: {
      username,
      passwordHash,
      realName,
      roles: ['admin'],
      permissions: ['catalog:read', 'catalog:write', 'inventory:read', 'inventory:write'],
    },
    update: { passwordHash, realName },
  });
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
