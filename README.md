# StoneLab Server

StoneLab 的管理后台与小程序 API。当前第一阶段包含：

- NestJS + Fastify 服务骨架、统一响应和异常处理
- PostgreSQL + Prisma 数据模型
- 管理员 JWT 登录，以及 Vben 所需的用户、权限码、菜单接口
- 分类、珠子商品、SKU 与库存流水接口
- 小程序公开目录只读接口
- Swagger 文档、Docker 本地依赖和基础测试

## 本地运行

要求 Node.js 22.20+（生产建议 Node.js 24 LTS）、npm 和 Docker。

```bash
cp .env.example .env
docker compose up -d postgres redis
npm install
npm run db:deploy
npm run db:seed
npm run dev
```

本地 PostgreSQL 默认监听 `localhost:5433`，避免与机器上已有的 `5432` 实例冲突；可通过 `POSTGRES_PORT` 覆盖。

默认服务地址为 `http://localhost:3100`，Swagger 地址为 `http://localhost:3100/api/docs`。

开发环境示例账号来自 `.env`：`admin / 123456`。部署前必须更换 JWT 密钥和初始密码。

## 主要接口

管理后台兼容接口：

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/codes`
- `GET /api/user/info`
- `GET /api/menu/all`

目录管理接口位于 `/api/admin/catalog/*`，均需 Bearer Token。

小程序只读接口：

- `GET /api/v1/app/catalog/categories`
- `GET /api/v1/app/catalog/products`

所有正常响应统一为：

```json
{
  "code": 0,
  "data": {},
  "message": "ok",
  "error": null
}
```

金额以人民币分存储；珠径使用 PostgreSQL Decimal；库存只能通过库存调整接口变更并记录流水。

## 清理未使用的 OSS 图片

脚本会比对数据库商品的 `imageKey` 与 OSS `beads/` 目录，仅将未被任何商品引用的图片列为候选。默认保护最近 24 小时上传的图片，避免误删尚未保存到商品的素材。

```bash
# 只检查，不删除
npm run oss:cleanup

# 删除检查出的未引用图片，并再次读取 OSS 验证结果
npm run oss:cleanup -- --delete

# 调整新图片保护时间，例如保护最近 48 小时
npm run oss:cleanup -- --delete --min-age-hours=48
```
