import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // generate/validate 不需要真实数据库；迁移与运行时仍应通过环境变量显式配置。
    url:
      process.env.DATABASE_URL ??
      'postgresql://stonelab:stonelab@localhost:5433/stonelab?schema=public',
  },
});
