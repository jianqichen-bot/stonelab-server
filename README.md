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
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

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
- `GET /api/v1/app/catalog/products/:id`

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
