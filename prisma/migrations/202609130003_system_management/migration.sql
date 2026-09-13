ALTER TABLE "admin_users"
  ADD COLUMN "phone" VARCHAR(20),
  ADD COLUMN "email" VARCHAR(100),
  ADD COLUMN "department_id" INTEGER;

CREATE TABLE "admin_departments" (
  "id" SERIAL NOT NULL,
  "parent_id" INTEGER,
  "name" VARCHAR(50) NOT NULL,
  "sort" INTEGER NOT NULL DEFAULT 0,
  "status" "RecordStatus" NOT NULL DEFAULT 'ENABLED',
  "remark" VARCHAR(255) NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "admin_departments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_menus" (
  "id" SERIAL NOT NULL,
  "parent_id" INTEGER,
  "name" VARCHAR(50) NOT NULL,
  "type" VARCHAR(16) NOT NULL,
  "path" VARCHAR(255) NOT NULL DEFAULT '',
  "component" VARCHAR(255) NOT NULL DEFAULT '',
  "permission" VARCHAR(100) NOT NULL DEFAULT '',
  "icon" VARCHAR(100) NOT NULL DEFAULT '',
  "sort" INTEGER NOT NULL DEFAULT 0,
  "status" "RecordStatus" NOT NULL DEFAULT 'ENABLED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "admin_menus_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_roles" (
  "id" SERIAL NOT NULL,
  "name" VARCHAR(50) NOT NULL,
  "status" "RecordStatus" NOT NULL DEFAULT 'ENABLED',
  "remark" VARCHAR(255) NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "_AdminMenuToAdminRole" (
  "A" INTEGER NOT NULL,
  "B" INTEGER NOT NULL,
  CONSTRAINT "_AdminMenuToAdminRole_AB_pkey" PRIMARY KEY ("A", "B")
);

CREATE TABLE "_AdminRoleToAdminUser" (
  "A" INTEGER NOT NULL,
  "B" TEXT NOT NULL,
  CONSTRAINT "_AdminRoleToAdminUser_AB_pkey" PRIMARY KEY ("A", "B")
);

CREATE UNIQUE INDEX "admin_roles_name_key" ON "admin_roles"("name");
CREATE INDEX "admin_departments_parent_id_sort_idx" ON "admin_departments"("parent_id", "sort");
CREATE INDEX "admin_menus_parent_id_sort_idx" ON "admin_menus"("parent_id", "sort");
CREATE INDEX "admin_menus_permission_idx" ON "admin_menus"("permission");
CREATE INDEX "_AdminMenuToAdminRole_B_index" ON "_AdminMenuToAdminRole"("B");
CREATE INDEX "_AdminRoleToAdminUser_B_index" ON "_AdminRoleToAdminUser"("B");
CREATE INDEX "admin_users_department_id_idx" ON "admin_users"("department_id");

ALTER TABLE "admin_departments"
  ADD CONSTRAINT "admin_departments_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "admin_departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admin_menus"
  ADD CONSTRAINT "admin_menus_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "admin_menus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admin_users"
  ADD CONSTRAINT "admin_users_department_id_fkey"
  FOREIGN KEY ("department_id") REFERENCES "admin_departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "_AdminMenuToAdminRole"
  ADD CONSTRAINT "_AdminMenuToAdminRole_A_fkey"
  FOREIGN KEY ("A") REFERENCES "admin_menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_AdminMenuToAdminRole"
  ADD CONSTRAINT "_AdminMenuToAdminRole_B_fkey"
  FOREIGN KEY ("B") REFERENCES "admin_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_AdminRoleToAdminUser"
  ADD CONSTRAINT "_AdminRoleToAdminUser_A_fkey"
  FOREIGN KEY ("A") REFERENCES "admin_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_AdminRoleToAdminUser"
  ADD CONSTRAINT "_AdminRoleToAdminUser_B_fkey"
  FOREIGN KEY ("B") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "admin_departments" ("id", "name", "sort", "status", "remark", "updated_at")
VALUES
  (1, 'StoneLab', 1, 'ENABLED', '总部', CURRENT_TIMESTAMP),
  (2, '产品部', 1, 'ENABLED', '负责商品与分类维护', CURRENT_TIMESTAMP),
  (3, '运营部', 2, 'ENABLED', '负责小程序日常运营', CURRENT_TIMESTAMP);
SELECT setval(pg_get_serial_sequence('"admin_departments"', 'id'), 3, true);

INSERT INTO "admin_roles" ("id", "name", "status", "remark", "updated_at")
VALUES
  (1, '超级管理员', 'ENABLED', '拥有全部后台权限', CURRENT_TIMESTAMP),
  (2, '商品运营', 'ENABLED', '维护分类与珠子商品', CURRENT_TIMESTAMP);
SELECT setval(pg_get_serial_sequence('"admin_roles"', 'id'), 2, true);

INSERT INTO "admin_menus"
  ("id", "parent_id", "name", "type", "path", "component", "permission", "icon", "sort", "status", "updated_at")
VALUES
  (10, NULL, '商品中心', 'DIRECTORY', '/catalog', '', '', 'lucide:gem', 10, 'ENABLED', CURRENT_TIMESTAMP),
  (11, 10, '分类管理', 'MENU', '/catalog/categories', '/catalog/categories/index', 'catalog:category:list', '', 1, 'ENABLED', CURRENT_TIMESTAMP),
  (12, 10, '珠子商品', 'MENU', '/catalog/products', '/catalog/products/index', 'catalog:product:list', '', 2, 'ENABLED', CURRENT_TIMESTAMP),
  (20, NULL, '系统管理', 'DIRECTORY', '/system', '', '', 'lucide:settings', 20, 'ENABLED', CURRENT_TIMESTAMP),
  (21, 20, '菜单管理', 'MENU', '/system/menus', '/system/menus/index', 'system:menu:list', '', 1, 'ENABLED', CURRENT_TIMESTAMP),
  (22, 20, '用户管理', 'MENU', '/system/users', '/system/users/index', 'system:user:list', '', 2, 'ENABLED', CURRENT_TIMESTAMP),
  (23, 20, '角色管理', 'MENU', '/system/roles', '/system/roles/index', 'system:role:list', '', 3, 'ENABLED', CURRENT_TIMESTAMP),
  (24, 20, '部门管理', 'MENU', '/system/departments', '/system/departments/index', 'system:department:list', '', 4, 'ENABLED', CURRENT_TIMESTAMP),
  (211, 21, '新建菜单', 'BUTTON', '', '', 'system:menu:create', '', 1, 'ENABLED', CURRENT_TIMESTAMP),
  (212, 21, '编辑菜单', 'BUTTON', '', '', 'system:menu:update', '', 2, 'ENABLED', CURRENT_TIMESTAMP),
  (213, 21, '删除菜单', 'BUTTON', '', '', 'system:menu:delete', '', 3, 'ENABLED', CURRENT_TIMESTAMP),
  (221, 22, '新建用户', 'BUTTON', '', '', 'system:user:create', '', 1, 'ENABLED', CURRENT_TIMESTAMP),
  (222, 22, '编辑用户', 'BUTTON', '', '', 'system:user:update', '', 2, 'ENABLED', CURRENT_TIMESTAMP),
  (223, 22, '删除用户', 'BUTTON', '', '', 'system:user:delete', '', 3, 'ENABLED', CURRENT_TIMESTAMP),
  (231, 23, '新建角色', 'BUTTON', '', '', 'system:role:create', '', 1, 'ENABLED', CURRENT_TIMESTAMP),
  (232, 23, '编辑角色', 'BUTTON', '', '', 'system:role:update', '', 2, 'ENABLED', CURRENT_TIMESTAMP),
  (233, 23, '删除角色', 'BUTTON', '', '', 'system:role:delete', '', 3, 'ENABLED', CURRENT_TIMESTAMP),
  (241, 24, '新建部门', 'BUTTON', '', '', 'system:department:create', '', 1, 'ENABLED', CURRENT_TIMESTAMP),
  (242, 24, '编辑部门', 'BUTTON', '', '', 'system:department:update', '', 2, 'ENABLED', CURRENT_TIMESTAMP),
  (243, 24, '删除部门', 'BUTTON', '', '', 'system:department:delete', '', 3, 'ENABLED', CURRENT_TIMESTAMP);
SELECT setval(pg_get_serial_sequence('"admin_menus"', 'id'), 243, true);

INSERT INTO "_AdminMenuToAdminRole" ("A", "B")
SELECT "id", 1 FROM "admin_menus";
INSERT INTO "_AdminMenuToAdminRole" ("A", "B")
SELECT "id", 2 FROM "admin_menus" WHERE "id" IN (10, 11, 12);
INSERT INTO "_AdminRoleToAdminUser" ("A", "B")
SELECT 1, "id" FROM "admin_users";
UPDATE "admin_users" SET "department_id" = 1 WHERE "department_id" IS NULL;
