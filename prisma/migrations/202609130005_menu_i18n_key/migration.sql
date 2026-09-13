ALTER TABLE "admin_menus" ADD COLUMN "i18n_key" VARCHAR(100);

UPDATE "admin_menus"
SET "i18n_key" = CASE "id"
  WHEN 10 THEN 'catalog.title'
  WHEN 11 THEN 'catalog.category.title'
  WHEN 12 THEN 'catalog.product.title'
  WHEN 20 THEN 'system.title'
  WHEN 21 THEN 'system.menu.title'
  WHEN 22 THEN 'system.user.title'
  WHEN 23 THEN 'system.role.title'
  WHEN 24 THEN 'system.department.title'
END
WHERE "id" IN (10, 11, 12, 20, 21, 22, 23, 24);

CREATE UNIQUE INDEX "admin_menus_i18n_key_key" ON "admin_menus"("i18n_key");

